import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('laser_settings', (t) => {
    // Source format of the uploaded xTool file backing `source_xcs`.
    //  - 'xcs' = legacy v1 monolithic JSON (raw text in source_xcs)
    //  - 'xs'  = v2 ZIP container (base64-encoded into source_xcs)
    t.enum('source_format', ['xcs', 'xs']).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('laser_settings', (t) => {
    t.dropColumn('source_format');
  });
}
