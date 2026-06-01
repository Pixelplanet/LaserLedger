import type { Knex } from 'knex';

export interface MaterialCategorySeed {
  name: string;
  slug: string;
  sort_order: number;
}

export interface MaterialSeed {
  category_slug: string;
  name: string;
  slug: string;
  thickness_mm?: number | null;
  color?: string | null;
  description?: string | null;
  sort_order: number;
}

export const MATERIAL_CATEGORY_SEEDS: MaterialCategorySeed[] = [
  { name: 'Metals', slug: 'metals', sort_order: 0 },
  { name: 'Wood', slug: 'wood', sort_order: 1 },
  { name: 'Acrylic/Plastic', slug: 'acrylic-plastic', sort_order: 2 },
  { name: 'Leather', slug: 'leather', sort_order: 3 },
  { name: 'Glass', slug: 'glass', sort_order: 4 },
  { name: 'Stone', slug: 'stone', sort_order: 5 },
  { name: 'Paper/Cardboard', slug: 'paper-cardboard', sort_order: 6 },
  { name: 'Fabric', slug: 'fabric', sort_order: 7 },
];

export const MATERIAL_SEEDS: MaterialSeed[] = [
  { category_slug: 'metals', name: '304 Stainless Steel', slug: '304-stainless-steel', color: 'Silver', description: 'Standard 304 stainless steel sheet.', sort_order: 0 },
  { category_slug: 'metals', name: 'Titanium', slug: 'titanium', color: 'Silver', description: 'Grade 2 titanium sheet.', sort_order: 1 },
  { category_slug: 'metals', name: 'Anodized Aluminum', slug: 'anodized-aluminum', color: 'Black', description: 'Anodized aluminum plate for high-contrast marking.', sort_order: 2 },
  { category_slug: 'metals', name: 'Brass', slug: 'brass', color: 'Gold', description: 'Brass sheet for decorative engraving.', sort_order: 3 },
  { category_slug: 'metals', name: 'Copper', slug: 'copper', color: 'Copper', description: 'Copper plate and sheet stock.', sort_order: 4 },

  { category_slug: 'wood', name: 'Birch Plywood', slug: 'birch-plywood', thickness_mm: 3, color: 'Natural', description: 'Standard birch ply for craft and signage cuts.', sort_order: 0 },
  { category_slug: 'wood', name: 'Basswood Plywood', slug: 'basswood-plywood', thickness_mm: 3, color: 'Natural', description: 'Soft hardwood plywood with low resin content.', sort_order: 1 },
  { category_slug: 'wood', name: 'MDF', slug: 'mdf', thickness_mm: 3, color: 'Brown', description: 'Medium-density fiberboard.', sort_order: 2 },
  { category_slug: 'wood', name: 'Walnut', slug: 'walnut', thickness_mm: 3, color: 'Dark Brown', description: 'Walnut veneer or sheet stock.', sort_order: 3 },

  { category_slug: 'acrylic-plastic', name: 'Cast Acrylic (Clear)', slug: 'cast-acrylic-clear', thickness_mm: 3, color: 'Clear', description: 'Cast acrylic sheet for clean engraved frosting.', sort_order: 0 },
  { category_slug: 'acrylic-plastic', name: 'Cast Acrylic (Black)', slug: 'cast-acrylic-black', thickness_mm: 3, color: 'Black', description: 'Opaque black cast acrylic.', sort_order: 1 },
  { category_slug: 'acrylic-plastic', name: 'PETG', slug: 'petg', thickness_mm: 1, color: 'Clear', description: 'PETG sheet for low-heat engraving.', sort_order: 2 },
  { category_slug: 'acrylic-plastic', name: 'Delrin (POM)', slug: 'delrin-pom', thickness_mm: 2, color: 'Black', description: 'Acetal engineering plastic.', sort_order: 3 },

  { category_slug: 'leather', name: 'Vegetable-Tanned Leather', slug: 'vegetable-tanned-leather', thickness_mm: 2, color: 'Natural', description: 'Leather suited for stamping and engraving.', sort_order: 0 },
  { category_slug: 'leather', name: 'PU Leather', slug: 'pu-leather', thickness_mm: 1, color: 'Black', description: 'Synthetic leather for surface marking.', sort_order: 1 },

  { category_slug: 'glass', name: 'Soda-Lime Glass', slug: 'soda-lime-glass', color: 'Clear', description: 'Common tumbler and pane glass.', sort_order: 0 },
  { category_slug: 'glass', name: 'Borosilicate Glass', slug: 'borosilicate-glass', color: 'Clear', description: 'Heat-resistant glass.', sort_order: 1 },

  { category_slug: 'stone', name: 'Slate', slug: 'slate', color: 'Gray', description: 'Natural slate coaster and tile stock.', sort_order: 0 },
  { category_slug: 'stone', name: 'Marble', slug: 'marble', color: 'White', description: 'Marble tile and slab stock.', sort_order: 1 },

  { category_slug: 'paper-cardboard', name: 'Kraft Cardstock', slug: 'kraft-cardstock', thickness_mm: 0.3, color: 'Brown', description: 'Heavy kraft card stock sheets.', sort_order: 0 },
  { category_slug: 'paper-cardboard', name: 'Corrugated Cardboard', slug: 'corrugated-cardboard', thickness_mm: 2.5, color: 'Brown', description: 'Single-wall corrugated board.', sort_order: 1 },

  { category_slug: 'fabric', name: 'Cotton Canvas', slug: 'cotton-canvas', thickness_mm: 0.8, color: 'Natural', description: 'Dense cotton canvas fabric.', sort_order: 0 },
  { category_slug: 'fabric', name: 'Felt', slug: 'felt', thickness_mm: 2, color: 'Gray', description: 'Wool or polyester felt sheets.', sort_order: 1 },

  { category_slug: 'paper-cardboard', name: 'Custom material', slug: 'custom-material', description: 'Fallback material for user-defined custom entries.', sort_order: 999 },
];

export interface MaterialCatalogSyncResult {
  categoriesInserted: number;
  materialsInserted: number;
}

export async function ensureMaterialCatalog(knex: Knex): Promise<MaterialCatalogSyncResult> {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const categoryIdBySlug = new Map<string, number>();
  let categoriesInserted = 0;
  let materialsInserted = 0;

  const existingCategories = await knex('material_categories').select<{ id: number; slug: string }[]>('id', 'slug');
  for (const row of existingCategories) categoryIdBySlug.set(row.slug, row.id);

  for (const cat of MATERIAL_CATEGORY_SEEDS) {
    const existingId = categoryIdBySlug.get(cat.slug);
    if (existingId) continue;
    const inserted = await knex('material_categories').insert({
      name: cat.name,
      slug: cat.slug,
      sort_order: cat.sort_order,
      created_at: now,
      updated_at: now,
    });
    const newId = Number((inserted as unknown as number[])[0]);
    categoryIdBySlug.set(cat.slug, newId);
    categoriesInserted += 1;
  }

  const existingMaterialRows = await knex('materials').select<{ slug: string }[]>('slug');
  const existingMaterialSlugs = new Set(existingMaterialRows.map((row) => row.slug));

  for (const mat of MATERIAL_SEEDS) {
    if (existingMaterialSlugs.has(mat.slug)) continue;
    const categoryId = categoryIdBySlug.get(mat.category_slug);
    if (!categoryId) continue;
    await knex('materials').insert({
      category_id: categoryId,
      name: mat.name,
      slug: mat.slug,
      thickness_mm: mat.thickness_mm ?? null,
      color: mat.color ?? null,
      description: mat.description ?? null,
      is_active: true,
      sort_order: mat.sort_order,
      created_at: now,
      updated_at: now,
    });
    materialsInserted += 1;
  }

  return { categoriesInserted, materialsInserted };
}
