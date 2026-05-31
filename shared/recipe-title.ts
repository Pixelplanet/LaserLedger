// Pure helper: build a human-readable recipe title from resolved display names.
// Used by the Quick Recipe submission flow to auto-generate (editable) titles.

export interface RecipeTitleParts {
  operation?: string | null;
  material?: string | null;
  thickness_mm?: number | null;
  device?: string | null;
  laser?: string | null;
}

/**
 * Compose a title like:
 *   "Cut — Birch Plywood (3mm) — F2 Ultra / Blue 10W"
 * Missing segments are dropped gracefully. Returns '' when nothing usable.
 */
export function buildRecipeTitle(parts: RecipeTitleParts): string {
  const operation = clean(parts.operation);
  const material = clean(parts.material);
  const device = clean(parts.device);
  const laser = clean(parts.laser);

  const materialLabel =
    material && parts.thickness_mm != null && Number.isFinite(parts.thickness_mm)
      ? `${material} (${formatThickness(parts.thickness_mm)}mm)`
      : material;

  const hardware = [device, laser].filter(Boolean).join(' / ');

  const segments = [operation, materialLabel, hardware].filter(Boolean);
  return segments.join(' — ');
}

function clean(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function formatThickness(mm: number): string {
  // Trim trailing zeros: 3 -> "3", 3.5 -> "3.5", 3.00 -> "3"
  return String(Number(mm.toFixed(2)));
}
