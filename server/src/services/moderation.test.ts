import { describe, expect, it } from 'vitest';
import { paramSimilarity } from './moderation.js';

describe('paramSimilarity', () => {
  it('returns 1 for identical params', () => {
    const p = { power: 50, speed: 1000, frequency: 30, lpi: 254 };
    expect(paramSimilarity(p, p)).toBe(1);
  });

  it('returns ~0 for very different power', () => {
    const a = { power: 0, speed: null, frequency: null, lpi: null };
    const b = { power: 100, speed: null, frequency: null, lpi: null };
    expect(paramSimilarity(a, b)).toBe(0);
  });

  it('ignores null params on either side', () => {
    const a = { power: 50, speed: null, frequency: null, lpi: null };
    const b = { power: 50, speed: 999, frequency: 999, lpi: 999 };
    expect(paramSimilarity(a, b)).toBe(1);
  });

  it('returns 0 when no overlap', () => {
    const a = { power: 50, speed: null, frequency: null, lpi: null };
    const b = { power: null, speed: 1000, frequency: null, lpi: null };
    expect(paramSimilarity(a, b)).toBe(0);
  });

  it('averages similarity across params', () => {
    const a = { power: 50, speed: 1000, frequency: null, lpi: null };
    const b = { power: 50, speed: 1500, frequency: null, lpi: null };
    // power sim = 1; speed sim = 1 - 500/5000 = 0.9; avg = 0.95
    expect(paramSimilarity(a, b)).toBeCloseTo(0.95, 2);
  });
});
