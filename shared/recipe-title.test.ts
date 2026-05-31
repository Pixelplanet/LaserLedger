import { describe, it, expect } from 'vitest';
import { buildRecipeTitle } from './recipe-title.js';

describe('buildRecipeTitle', () => {
  it('builds a full title with all parts', () => {
    expect(
      buildRecipeTitle({
        operation: 'Cut',
        material: 'Birch Plywood',
        thickness_mm: 3,
        device: 'F2 Ultra',
        laser: 'Blue 10W',
      }),
    ).toBe('Cut — Birch Plywood (3mm) — F2 Ultra / Blue 10W');
  });

  it('omits thickness when not provided', () => {
    expect(
      buildRecipeTitle({
        operation: 'Engrave',
        material: 'Anodized Aluminum',
        device: 'F2',
        laser: 'IR',
      }),
    ).toBe('Engrave — Anodized Aluminum — F2 / IR');
  });

  it('omits laser when missing', () => {
    expect(
      buildRecipeTitle({
        operation: 'Mark',
        material: 'Stainless Steel',
        device: 'F2 Ultra',
      }),
    ).toBe('Mark — Stainless Steel — F2 Ultra');
  });

  it('drops device/laser segment entirely when both missing', () => {
    expect(
      buildRecipeTitle({ operation: 'Cut', material: 'Acrylic', thickness_mm: 5 }),
    ).toBe('Cut — Acrylic (5mm)');
  });

  it('trims trailing zeros on thickness', () => {
    expect(
      buildRecipeTitle({ operation: 'Cut', material: 'MDF', thickness_mm: 3.5 }),
    ).toBe('Cut — MDF (3.5mm)');
    expect(
      buildRecipeTitle({ operation: 'Cut', material: 'MDF', thickness_mm: 3.0 }),
    ).toBe('Cut — MDF (3mm)');
  });

  it('returns empty string when nothing usable', () => {
    expect(buildRecipeTitle({})).toBe('');
    expect(buildRecipeTitle({ operation: '   ', material: null })).toBe('');
  });

  it('handles only material with thickness', () => {
    expect(buildRecipeTitle({ material: 'Leather', thickness_mm: 2 })).toBe('Leather (2mm)');
  });
});
