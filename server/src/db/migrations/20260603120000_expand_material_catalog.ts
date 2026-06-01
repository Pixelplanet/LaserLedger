import type { Knex } from 'knex';
import { ensureMaterialCatalog, MATERIAL_SEEDS } from '../material-catalog.js';

export async function up(knex: Knex): Promise<void> {
  await ensureMaterialCatalog(knex);
}

export async function down(knex: Knex): Promise<void> {
  const slugs = MATERIAL_SEEDS.map((m) => m.slug);
  await knex('materials').whereIn('slug', slugs).del();
}
