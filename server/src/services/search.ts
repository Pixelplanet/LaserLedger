import type { Knex } from 'knex';
import type { SearchQuery } from '@shared/schemas.js';
import { isMySQL } from '../db/index.js';

/**
 * Build a Knex query for searching laser settings with all the filter dimensions
 * defined in §8 of the design document. Returns a query you can `.then()` for results.
 */
export function buildSearchQuery(
  knex: Knex,
  q: SearchQuery,
  options: { count?: boolean; includeStatus?: ('approved' | 'pending')[] } = {},
): Knex.QueryBuilder {
  const { count = false, includeStatus = ['approved'] } = options;

  let qb = knex('laser_settings as s')
    .leftJoin('devices as d', 'd.id', 's.device_id')
    .leftJoin('device_families as df', 'df.id', 'd.family_id')
    .leftJoin('manufacturers as mf', 'mf.id', 'df.manufacturer_id')
    .leftJoin('laser_types as lt', 'lt.id', 's.laser_type_id')
    .leftJoin('materials as m', 'm.id', 's.material_id')
    .leftJoin('material_categories as mc', 'mc.id', 'm.category_id')
    .leftJoin('operation_types as ot', 'ot.id', 's.operation_type_id')
    .whereIn('s.status', includeStatus);

  // Multi-select filters (comma-separated id lists)
  applyIdFilter(qb, q.device, 's.device_id');
  applyIdFilter(qb, q.laser_type, 's.laser_type_id');
  applyIdFilter(qb, q.material, 's.material_id');
  applyIdFilter(qb, q.material_category, 'm.category_id');
  applyIdFilter(qb, q.operation, 's.operation_type_id');
  applyIdFilter(qb, q.manufacturer, 'df.manufacturer_id');

  // Range filters
  applyRange(qb, 's.power', q.power_min, q.power_max);
  applyRange(qb, 's.speed', q.speed_min, q.speed_max);
  applyRange(qb, 's.frequency', q.frequency_min, q.frequency_max);
  applyRange(qb, 's.lpi', q.lpi_min, q.lpi_max);

  if (q.min_rating !== undefined && q.min_rating > 0) {
    qb = qb.where('s.vote_score', '>=', q.min_rating);
  }
  if (q.has_image) {
    qb = qb.whereNotNull('s.result_image_url');
  }

  // Tag filter (comma-separated tag slugs)
  if (q.tags) {
    const tagList = q.tags
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (tagList.length > 0) {
      qb = qb.whereExists((sub) =>
        sub
          .select('*')
          .from('laser_setting_tags as lst')
          .join('setting_tags as t', 't.id', 'lst.tag_id')
          .whereRaw('lst.setting_id = s.id')
          .whereIn('t.slug', tagList),
      );
    }
  }

  // Full-text search
  if (q.q && q.q.trim()) {
    const term = q.q.trim();
    if (isMySQL()) {
      qb = qb.whereRaw(
        'MATCH(s.title, s.description, s.result_description) AGAINST (? IN NATURAL LANGUAGE MODE)',
        [term],
      );
    } else {
      // SQLite fallback — LIKE search on title/description
      const like = `%${term}%`;
      qb = qb.where((b) =>
        b
          .where('s.title', 'like', like)
          .orWhere('s.description', 'like', like)
          .orWhere('s.result_description', 'like', like),
      );
    }
  }

  if (count) {
    return qb.count<{ count: number }[]>({ count: 's.id' });
  }

  // Sort
  switch (q.sort) {
    case 'newest':
      qb = qb.orderBy('s.created_at', 'desc');
      break;
    case 'top_rated':
      qb = qb.orderBy('s.vote_score', 'desc').orderBy('s.created_at', 'desc');
      break;
    case 'most_viewed':
      qb = qb.orderBy('s.view_count', 'desc');
      break;
    case 'most_discussed':
      qb = qb.orderBy('s.comment_count', 'desc');
      break;
    case 'relevance':
    default:
      // Relevance only meaningful with a search term; otherwise fall back to newest
      qb = qb.orderBy('s.created_at', 'desc');
      break;
  }

  // Selection — joined names for display
  qb = qb.select(
    's.id',
    's.uuid',
    's.title',
    's.description',
    's.power',
    's.speed',
    's.frequency',
    's.lpi',
    's.pulse_width',
    's.passes',
    's.vote_score',
    's.view_count',
    's.comment_count',
    's.result_image_url',
    's.status',
    's.created_at',
    's.submitted_by',
    'd.id as device_id',
    'd.name as device_name',
    'd.slug as device_slug',
    'df.name as family_name',
    'mf.name as manufacturer_name',
    'lt.id as laser_type_id',
    'lt.name as laser_type_name',
    'lt.slug as laser_type_slug',
    'm.id as material_id',
    'm.name as material_name',
    'm.slug as material_slug',
    'mc.name as material_category_name',
    'ot.id as operation_type_id',
    'ot.name as operation_type_name',
    'ot.slug as operation_type_slug',
  );

  // Pagination
  const offset = (q.page - 1) * q.pageSize;
  return qb.limit(q.pageSize).offset(offset);
}

function applyIdFilter(qb: Knex.QueryBuilder, raw: string | undefined, column: string): void {
  if (!raw) return;
  const ids = raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length > 0) qb.whereIn(column, ids);
}

function applyRange(
  qb: Knex.QueryBuilder,
  column: string,
  min: number | undefined,
  max: number | undefined,
): void {
  if (min !== undefined && Number.isFinite(min)) qb.where(column, '>=', min);
  if (max !== undefined && Number.isFinite(max)) qb.where(column, '<=', max);
}
