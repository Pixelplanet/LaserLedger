import type { Knex } from 'knex';

const isMysql = (knex: Knex) => knex.client.config.client === 'mysql2';

export async function up(knex: Knex): Promise<void> {
  const mysql = isMysql(knex);

  // ───────────── users ─────────────
  await knex.schema.createTable('users', (t) => {
    t.string('id', 16).primary();
    t.string('email', 255).notNullable().unique();
    t.string('display_name', 100).notNullable();
    t.text('password_hash').nullable();
    t.string('google_id', 255).nullable().unique();
    t.enum('role', ['user', 'moderator', 'admin']).notNullable().defaultTo('user');
    t.boolean('email_verified').notNullable().defaultTo(false);
    t.string('cloudify_user_id', 16).nullable().unique();
    t.string('timezone', 64).nullable();
    t.text('bio').nullable();
    t.string('avatar_url', 512).nullable();
    t.integer('submission_count').notNullable().defaultTo(0);
    t.integer('reputation').notNullable().defaultTo(0);
    t.dateTime('created_at').notNullable();
    t.dateTime('updated_at').notNullable();
    t.dateTime('last_login_at').nullable();
  });

  // ───────────── manufacturers ─────────────
  await knex.schema.createTable('manufacturers', (t) => {
    t.increments('id').primary();
    t.string('name', 100).notNullable().unique();
    t.string('slug', 100).notNullable().unique();
    t.string('website', 512).nullable();
    t.string('logo_url', 512).nullable();
    t.text('description').nullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.integer('sort_order').notNullable().defaultTo(0);
    t.dateTime('created_at').notNullable();
    t.dateTime('updated_at').notNullable();
  });

  // ───────────── device_families ─────────────
  await knex.schema.createTable('device_families', (t) => {
    t.increments('id').primary();
    t.integer('manufacturer_id').unsigned().notNullable().references('id').inTable('manufacturers');
    t.string('name', 100).notNullable();
    t.string('slug', 100).notNullable().unique();
    t.text('description').nullable();
    t.integer('sort_order').notNullable().defaultTo(0);
    t.dateTime('created_at').notNullable();
    t.dateTime('updated_at').notNullable();
  });

  // ───────────── devices ─────────────
  await knex.schema.createTable('devices', (t) => {
    t.increments('id').primary();
    t.integer('family_id').unsigned().notNullable().references('id').inTable('device_families');
    t.string('name', 150).notNullable();
    t.string('slug', 150).notNullable().unique();
    t.string('ext_id', 50).nullable();
    t.string('ext_name', 100).nullable();
    t.text('description').nullable();
    t.string('image_url', 512).nullable();
    t.string('product_url', 512).nullable();
    t.decimal('workspace_width', 8, 2).nullable();
    t.decimal('workspace_height', 8, 2).nullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.integer('sort_order').notNullable().defaultTo(0);
    t.dateTime('created_at').notNullable();
    t.dateTime('updated_at').notNullable();
    t.index(['family_id', 'is_active']);
  });

  // ───────────── laser_types ─────────────
  await knex.schema.createTable('laser_types', (t) => {
    t.increments('id').primary();
    t.string('name', 100).notNullable();
    t.string('slug', 100).notNullable().unique();
    t.string('light_source', 30).notNullable();
    t.integer('wavelength_nm').nullable();
    t.boolean('has_pulse_width').notNullable().defaultTo(false);
    t.boolean('has_mopa_frequency').notNullable().defaultTo(false);
    t.string('processing_type', 50).nullable();
    t.text('description').nullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.integer('sort_order').notNullable().defaultTo(0);
    t.dateTime('created_at').notNullable();
    t.dateTime('updated_at').notNullable();
  });

  // ───────────── device_laser_types ─────────────
  await knex.schema.createTable('device_laser_types', (t) => {
    t.integer('device_id').unsigned().notNullable().references('id').inTable('devices');
    t.integer('laser_type_id').unsigned().notNullable().references('id').inTable('laser_types');
    t.boolean('is_default').notNullable().defaultTo(false);
    t.json('power_watts').nullable();
    t.primary(['device_id', 'laser_type_id']);
  });

  // ───────────── material_categories ─────────────
  await knex.schema.createTable('material_categories', (t) => {
    t.increments('id').primary();
    t.string('name', 100).notNullable().unique();
    t.string('slug', 100).notNullable().unique();
    t.string('icon', 50).nullable();
    t.integer('sort_order').notNullable().defaultTo(0);
    t.dateTime('created_at').notNullable();
    t.dateTime('updated_at').notNullable();
  });

  // ───────────── materials ─────────────
  await knex.schema.createTable('materials', (t) => {
    t.increments('id').primary();
    t.integer('category_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('material_categories');
    t.string('name', 150).notNullable();
    t.string('slug', 150).notNullable().unique();
    t.integer('xtool_material_id').nullable();
    t.decimal('thickness_mm', 6, 2).nullable();
    t.string('color', 50).nullable();
    t.text('description').nullable();
    t.json('properties').nullable();
    t.string('image_url', 512).nullable();
    t.boolean('is_active').notNullable().defaultTo(true);
    t.integer('sort_order').notNullable().defaultTo(0);
    t.dateTime('created_at').notNullable();
    t.dateTime('updated_at').notNullable();
    t.index(['category_id', 'is_active']);
    t.index('xtool_material_id');
  });

  // ───────────── operation_types ─────────────
  await knex.schema.createTable('operation_types', (t) => {
    t.increments('id').primary();
    t.string('name', 100).notNullable().unique();
    t.string('slug', 100).notNullable().unique();
    t.text('description').nullable();
    t.integer('sort_order').notNullable().defaultTo(0);
    t.dateTime('created_at').notNullable();
    t.dateTime('updated_at').notNullable();
  });

  // ───────────── laser_settings ─────────────
  await knex.schema.createTable('laser_settings', (t) => {
    t.increments('id').primary();
    t.string('uuid', 36).notNullable().unique();
    t.string('title', 200).notNullable();
    t.text('description').nullable();
    t.integer('device_id').unsigned().notNullable().references('id').inTable('devices');
    t.integer('laser_type_id').unsigned().notNullable().references('id').inTable('laser_types');
    t.integer('material_id').unsigned().notNullable().references('id').inTable('materials');
    t.integer('operation_type_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('operation_types');
    t.decimal('power', 5, 1).nullable();
    t.decimal('speed', 8, 1).nullable();
    t.decimal('frequency', 10, 1).nullable();
    t.integer('lpi').nullable();
    t.integer('pulse_width').nullable();
    t.integer('passes').nullable().defaultTo(1);
    t.boolean('cross_hatch').nullable();
    t.decimal('focus_offset', 5, 2).nullable();
    t.string('scan_mode', 20).nullable();
    t.json('extra_params').nullable();
    t.text('result_description').nullable();
    t.string('result_image_url', 512).nullable();
    t.text('source_xcs').nullable();
    t.tinyint('quality_rating').nullable();
    t.string('submitted_by', 16).notNullable().references('id').inTable('users');
    t.enum('status', ['draft', 'pending', 'approved', 'rejected', 'archived'])
      .notNullable()
      .defaultTo('pending');
    t.string('moderated_by', 16).nullable().references('id').inTable('users');
    t.dateTime('moderated_at').nullable();
    t.text('rejection_reason').nullable();
    t.integer('vote_score').notNullable().defaultTo(0);
    t.integer('view_count').notNullable().defaultTo(0);
    t.integer('comment_count').notNullable().defaultTo(0);
    t.dateTime('created_at').notNullable();
    t.dateTime('updated_at').notNullable();
    t.index(['device_id', 'status'], 'idx_settings_device');
    t.index(['material_id', 'status'], 'idx_settings_material');
    t.index(['laser_type_id', 'status'], 'idx_settings_laser_type');
    t.index(['operation_type_id', 'status'], 'idx_settings_operation');
    t.index(['status', 'created_at'], 'idx_settings_status');
    t.index(['submitted_by', 'status'], 'idx_settings_user');
    t.index(['vote_score', 'status'], 'idx_settings_votes');
    t.index(
      ['status', 'device_id', 'material_id', 'laser_type_id'],
      'idx_settings_search',
    );
  });

  if (mysql) {
    // FULLTEXT index — MySQL only
    await knex.raw(
      'ALTER TABLE laser_settings ADD FULLTEXT INDEX idx_settings_fulltext (title, description, result_description)',
    );
  }

  // ───────────── tags ─────────────
  await knex.schema.createTable('setting_tags', (t) => {
    t.increments('id').primary();
    t.string('name', 50).notNullable().unique();
    t.string('slug', 50).notNullable().unique();
    t.integer('usage_count').notNullable().defaultTo(0);
    t.text('description').nullable();
    t.dateTime('created_at').notNullable();
    t.dateTime('updated_at').nullable();
  });
  await knex.schema.createTable('laser_setting_tags', (t) => {
    t.integer('setting_id').unsigned().notNullable().references('id').inTable('laser_settings');
    t.integer('tag_id').unsigned().notNullable().references('id').inTable('setting_tags');
    t.primary(['setting_id', 'tag_id']);
    t.index('tag_id');
  });

  // ───────────── votes ─────────────
  await knex.schema.createTable('votes', (t) => {
    t.increments('id').primary();
    t.integer('setting_id').unsigned().notNullable().references('id').inTable('laser_settings');
    t.string('user_id', 16).notNullable().references('id').inTable('users');
    t.dateTime('created_at').notNullable();
    t.unique(['setting_id', 'user_id']);
  });

  // ───────────── comments ─────────────
  await knex.schema.createTable('comments', (t) => {
    t.increments('id').primary();
    t.integer('setting_id').unsigned().notNullable().references('id').inTable('laser_settings');
    t.string('user_id', 16).notNullable().references('id').inTable('users');
    t.integer('parent_id').unsigned().nullable().references('id').inTable('comments');
    t.text('body').notNullable();
    t.boolean('is_deleted').notNullable().defaultTo(false);
    t.dateTime('created_at').notNullable();
    t.dateTime('updated_at').notNullable();
    t.index(['setting_id', 'created_at']);
  });

  // ───────────── moderation_log ─────────────
  await knex.schema.createTable('moderation_log', (t) => {
    t.increments('id').primary();
    t.string('moderator_id', 16).notNullable().references('id').inTable('users');
    t.enum('target_type', ['setting', 'image', 'comment', 'user', 'report', 'cms_entity']).notNullable();
    t.integer('target_id').notNullable();
    t.enum('action', ['approve', 'reject', 'archive', 'edit', 'revert', 'create', 'update', 'delete']).notNullable();
    t.text('reason').nullable();
    t.text('notes').nullable();
    t.dateTime('created_at').notNullable();
    t.index(['moderator_id', 'created_at']);
    t.index(['target_type', 'target_id']);
  });

  // ───────────── tokens ─────────────
  await knex.schema.createTable('email_verification_tokens', (t) => {
    t.string('token', 64).primary();
    t.string('user_id', 16).notNullable().references('id').inTable('users');
    t.dateTime('expires_at').notNullable();
    t.boolean('used').notNullable().defaultTo(false);
  });
  await knex.schema.createTable('password_reset_tokens', (t) => {
    t.string('token', 64).primary();
    t.string('user_id', 16).notNullable().references('id').inTable('users');
    t.dateTime('expires_at').notNullable();
    t.boolean('used').notNullable().defaultTo(false);
  });

  // ───────────── system_settings ─────────────
  await knex.schema.createTable('system_settings', (t) => {
    t.string('key', 100).primary();
    t.text('value').notNullable();
    t.dateTime('updated_at').notNullable();
  });

  // ───────────── setting_images ─────────────
  await knex.schema.createTable('setting_images', (t) => {
    t.increments('id').primary();
    t.string('uuid', 36).notNullable().unique();
    t.integer('setting_id').unsigned().notNullable().references('id').inTable('laser_settings');
    t.string('uploaded_by', 16).notNullable().references('id').inTable('users');
    t.string('original_filename', 255).notNullable();
    t.string('stored_path', 512).notNullable();
    t.string('thumbnail_path', 512).notNullable();
    t.string('mime_type', 50).notNullable();
    t.integer('file_size').notNullable();
    t.integer('width').nullable();
    t.integer('height').nullable();
    t.string('card_path', 512).nullable();
    t.string('caption', 500).nullable();
    t.enum('status', ['pending', 'approved', 'rejected', 'archived'])
      .notNullable()
      .defaultTo('pending');
    t.string('moderated_by', 16).nullable().references('id').inTable('users');
    t.dateTime('moderated_at').nullable();
    t.string('rejected_reason', 255).nullable();
    t.integer('sort_order').notNullable().defaultTo(0);
    t.boolean('is_primary').notNullable().defaultTo(false);
    t.dateTime('created_at').notNullable();
    t.index(['setting_id', 'status', 'sort_order'], 'idx_images_setting');
    t.index(['status', 'created_at'], 'idx_images_status');
    t.index('uploaded_by', 'idx_images_user');
  });

  // ───────────── user_bookmarks ─────────────
  await knex.schema.createTable('user_bookmarks', (t) => {
    t.increments('id').primary();
    t.string('user_id', 16).notNullable().references('id').inTable('users');
    t.integer('setting_id').unsigned().notNullable().references('id').inTable('laser_settings');
    t.dateTime('created_at').notNullable();
    t.unique(['user_id', 'setting_id']);
  });

  // ───────────── content_reports ─────────────
  await knex.schema.createTable('content_reports', (t) => {
    t.increments('id').primary();
    t.string('reporter_id', 16).notNullable().references('id').inTable('users');
    t.enum('target_type', ['setting', 'comment', 'image']).notNullable();
    t.integer('target_id').notNullable();
    t.enum('reason', [
      'spam',
      'inappropriate',
      'illegal',
      'duplicate',
      'misleading',
      'other',
    ]).notNullable();
    t.text('description').nullable();
    t.enum('status', ['pending', 'reviewed', 'dismissed', 'resolved', 'actioned'])
      .notNullable()
      .defaultTo('pending');
    t.string('resolved_by', 16).nullable().references('id').inTable('users');
    t.dateTime('resolved_at').nullable();
    t.string('resolution_action', 50).nullable();
    t.dateTime('created_at').notNullable();
    t.index(['status', 'created_at'], 'idx_reports_status');
    t.index(['target_type', 'target_id'], 'idx_reports_target');
  });
}

export async function down(knex: Knex): Promise<void> {
  const tables = [
    'content_reports',
    'user_bookmarks',
    'setting_images',
    'system_settings',
    'password_reset_tokens',
    'email_verification_tokens',
    'moderation_log',
    'comments',
    'votes',
    'laser_setting_tags',
    'setting_tags',
    'laser_settings',
    'operation_types',
    'materials',
    'material_categories',
    'device_laser_types',
    'laser_types',
    'devices',
    'device_families',
    'manufacturers',
    'users',
  ];
  for (const table of tables) {
    await knex.schema.dropTableIfExists(table);
  }
}
