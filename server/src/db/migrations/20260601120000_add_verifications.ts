import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('setting_verifications', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('setting_id').unsigned().notNullable().references('id').inTable('laser_settings').onDelete('CASCADE');
    t.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    // outcome of reproducing the published setting
    t.enum('outcome', ['worked', 'partial', 'failed']).notNullable();
    t.string('note', 1000).nullable();
    t.timestamp('created_at').notNullable();
    t.unique(['setting_id', 'user_id']);
  });
  // Denormalized counters for cheap reads on detail/cards.
  await knex.schema.alterTable('laser_settings', (t) => {
    t.integer('verified_worked_count').notNullable().defaultTo(0);
    t.integer('verified_failed_count').notNullable().defaultTo(0);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('laser_settings', (t) => {
    t.dropColumn('verified_worked_count');
    t.dropColumn('verified_failed_count');
  });
  await knex.schema.dropTableIfExists('setting_verifications');
}
