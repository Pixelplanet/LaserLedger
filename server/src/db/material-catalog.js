// Barrel file: re-exports the TypeScript source so vitest can resolve
// the .js import used by the migration. In production, tsc compiles the
// .ts source directly; this file exists only to bridge the ESM gap.
export { ensureMaterialCatalog, MATERIAL_SEEDS } from './material-catalog.ts';
