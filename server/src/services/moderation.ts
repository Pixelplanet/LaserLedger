import { db } from '../db/index.js';

/**
 * Compute similarity (0..1) between two laser parameter sets.
 * Uses normalized absolute difference per parameter, averaged.
 * Used for duplicate detection (§11.3).
 */
export function paramSimilarity(
  a: {
    power: number | null;
    speed: number | null;
    frequency: number | null;
    lpi: number | null;
  },
  b: typeof a,
): number {
  // Reasonable max ranges for normalization
  const ranges = { power: 100, speed: 5000, frequency: 1000, lpi: 5000 };
  const keys = ['power', 'speed', 'frequency', 'lpi'] as const;
  let sum = 0;
  let count = 0;
  for (const k of keys) {
    const av = a[k];
    const bv = b[k];
    if (av === null || bv === null) continue;
    const diff = Math.abs(av - bv);
    const sim = Math.max(0, 1 - diff / ranges[k]);
    sum += sim;
    count++;
  }
  return count === 0 ? 0 : sum / count;
}

/** Look up reputation + approved-submission count for a user. */
export async function userTrust(userId: string): Promise<{ reputation: number; approved: number }> {
  const [user] = await db('users').where({ id: userId }).select('reputation');
  const approved = await db('laser_settings')
    .where({ submitted_by: userId, status: 'approved' })
    .count<{ c: number }[]>({ c: '*' });
  return {
    reputation: Number(user?.reputation ?? 0),
    approved: Number(approved[0]?.c ?? 0),
  };
}

/** Determine whether a submission qualifies for auto-approval (§11.2). */
export async function shouldAutoApprove(userId: string): Promise<boolean> {
  const { reputation, approved } = await userTrust(userId);
  const threshold = await getSetting('auto_approve_reputation_threshold', 50);
  const minApproved = await getSetting('auto_approve_min_approved_submissions', 5);
  return reputation >= threshold && approved >= minApproved;
}

/** Find similar settings for duplicate-warning during moderation (§11.3). */
export async function findSimilarSettings(
  params: { device_id: number; material_id: number; laser_type_id: number },
  laserParams: Parameters<typeof paramSimilarity>[0],
  threshold: number,
  excludeId?: number,
) {
  let qb = db('laser_settings')
    .where({
      device_id: params.device_id,
      material_id: params.material_id,
      laser_type_id: params.laser_type_id,
      status: 'approved',
    })
    .select('id', 'uuid', 'title', 'power', 'speed', 'frequency', 'lpi');
  if (excludeId) qb = qb.whereNot('id', excludeId);
  const candidates = await qb;
  return candidates
    .map((c) => ({ ...c, similarity: paramSimilarity(laserParams, c) }))
    .filter((c) => c.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity);
}

async function getSetting(key: string, fallback: number): Promise<number> {
  const row = await db('system_settings').where({ key }).first();
  if (!row) return fallback;
  const n = Number(row.value);
  return Number.isFinite(n) ? n : fallback;
}
