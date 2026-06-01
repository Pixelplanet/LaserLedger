import type { Knex } from 'knex';

const REPORT_TYPES = ['setting', 'comment', 'image', 'collection'];
const REPORT_TYPES_OLD = ['setting', 'comment', 'image'];
const MOD_TYPES = ['setting', 'image', 'comment', 'user', 'report', 'cms_entity', 'collection'];
const MOD_TYPES_OLD = ['setting', 'image', 'comment', 'user', 'report', 'cms_entity'];

function isSqlite(knex: Knex): boolean {
  return knex.client.dialect === 'sqlite3';
}

function mysqlRows<T>(rawResult: unknown): T[] {
  if (Array.isArray(rawResult) && Array.isArray(rawResult[0])) {
    return rawResult[0] as T[];
  }
  if (Array.isArray(rawResult)) {
    return rawResult as T[];
  }
  return [];
}

async function mysqlEnumContains(
  knex: Knex,
  table: string,
  column: string,
  value: string,
): Promise<boolean> {
  const result = await knex.raw(
    `SELECT COLUMN_TYPE
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?`,
    [table, column],
  );
  const rows = mysqlRows<{ COLUMN_TYPE?: string; column_type?: string }>(result);
  const columnType = rows[0]?.COLUMN_TYPE ?? rows[0]?.column_type ?? '';
  return columnType.includes(`'${value}'`);
}

// SQLite cannot alter CHECK constraints in place. These tables are empty at the
// point this migration runs (no reports/moderation actions exist yet), so we
// rebuild them. On MySQL we widen the native ENUM.
async function recreateContentReports(knex: Knex, targetTypes: string[]): Promise<void> {
  await knex.schema.dropTableIfExists('content_reports');
  await knex.schema.createTable('content_reports', (t) => {
    t.increments('id').primary();
    t.string('reporter_id', 16).notNullable().references('id').inTable('users');
    t.enum('target_type', targetTypes).notNullable();
    t.integer('target_id').notNullable();
    t.enum('reason', ['spam', 'inappropriate', 'illegal', 'duplicate', 'misleading', 'other']).notNullable();
    t.text('description').nullable();
    t.enum('status', ['pending', 'reviewed', 'dismissed', 'resolved', 'actioned']).notNullable().defaultTo('pending');
    t.string('resolved_by', 16).nullable().references('id').inTable('users');
    t.dateTime('resolved_at').nullable();
    t.string('resolution_action', 50).nullable();
    t.dateTime('created_at').notNullable();
    t.index(['status', 'created_at'], 'idx_reports_status');
    t.index(['target_type', 'target_id'], 'idx_reports_target');
  });
}

async function recreateModerationLog(knex: Knex, targetTypes: string[]): Promise<void> {
  await knex.schema.dropTableIfExists('moderation_log');
  await knex.schema.createTable('moderation_log', (t) => {
    t.increments('id').primary();
    t.string('moderator_id', 16).notNullable().references('id').inTable('users');
    t.enum('target_type', targetTypes).notNullable();
    t.integer('target_id').notNullable();
    t.enum('action', ['approve', 'reject', 'archive', 'edit', 'revert', 'create', 'update', 'delete']).notNullable();
    t.text('reason').nullable();
    t.text('notes').nullable();
    t.dateTime('created_at').notNullable();
    t.index(['moderator_id', 'created_at']);
    t.index(['target_type', 'target_id']);
  });
}

export async function up(knex: Knex): Promise<void> {
  const hasCollections = await knex.schema.hasTable('collections');
  if (!hasCollections) {
    await knex.schema.createTable('collections', (t) => {
      t.bigIncrements('id').primary();
      t.string('uuid', 36).notNullable().unique();
      t.string('user_id', 16).notNullable().references('id').inTable('users').onDelete('CASCADE');
      t.string('name', 120).notNullable();
      t.string('description', 2000).nullable();
      t.boolean('is_public').notNullable().defaultTo(false);
      t.dateTime('created_at').notNullable();
      t.dateTime('updated_at').notNullable();
      t.index(['user_id']);
    });
  }

  const hasCollectionItems = await knex.schema.hasTable('collection_items');
  if (!hasCollectionItems) {
    await knex.schema.createTable('collection_items', (t) => {
      t.bigIncrements('id').primary();
      t.bigInteger('collection_id').unsigned().notNullable().references('id').inTable('collections').onDelete('CASCADE');
      t.bigInteger('setting_id').unsigned().notNullable().references('id').inTable('laser_settings').onDelete('CASCADE');
      t.integer('sort_order').notNullable().defaultTo(0);
      t.dateTime('added_at').notNullable();
      t.unique(['collection_id', 'setting_id']);
    });
  }

  // Allow collections to be reported and moderated.
  if (isSqlite(knex)) {
    await recreateContentReports(knex, REPORT_TYPES);
    await recreateModerationLog(knex, MOD_TYPES);
  } else {
    if (!(await mysqlEnumContains(knex, 'content_reports', 'target_type', 'collection'))) {
      await knex.raw(
        "ALTER TABLE `content_reports` MODIFY COLUMN `target_type` ENUM('setting','comment','image','collection') NOT NULL",
      );
    }
    if (!(await mysqlEnumContains(knex, 'moderation_log', 'target_type', 'collection'))) {
      await knex.raw(
        "ALTER TABLE `moderation_log` MODIFY COLUMN `target_type` ENUM('setting','image','comment','user','report','cms_entity','collection') NOT NULL",
      );
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  if (isSqlite(knex)) {
    await recreateModerationLog(knex, MOD_TYPES_OLD);
    await recreateContentReports(knex, REPORT_TYPES_OLD);
  } else {
    await knex.raw(
      "ALTER TABLE `moderation_log` MODIFY COLUMN `target_type` ENUM('setting','image','comment','user','report','cms_entity') NOT NULL",
    );
    await knex.raw(
      "ALTER TABLE `content_reports` MODIFY COLUMN `target_type` ENUM('setting','comment','image') NOT NULL",
    );
  }
  await knex.schema.dropTableIfExists('collection_items');
  await knex.schema.dropTableIfExists('collections');
}
