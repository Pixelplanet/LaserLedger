import knex from 'knex';
import { describe, expect, it } from 'vitest';
import { buildSearchQuery } from './search.js';

describe('buildSearchQuery', () => {
  const db = knex({ client: 'mysql2' });

  it('applies core filters and pagination', () => {
    const query = buildSearchQuery(db, {
      q: 'stainless',
      device: '1,2',
      tags: 'deep-engrave,metal',
      power_min: 20,
      power_max: 80,
      sort: 'top_rated',
      page: 2,
      pageSize: 10,
    });

    const sql = query.toSQL();
    expect(sql.sql).toContain('from `laser_settings` as `s`');
    expect(sql.sql).toContain('where `s`.`status` in (?)');
    expect(sql.sql).toContain('`s`.`device_id` in (?, ?)');
    expect(sql.sql).toContain('`s`.`power` >= ?');
    expect(sql.sql).toContain('`s`.`power` <= ?');
    expect(sql.sql).toContain('order by `s`.`vote_score` desc');
    expect(sql.sql).toContain('limit ?');
    expect(sql.sql).toContain('offset ?');
  });

  it('builds count query when requested', () => {
    const query = buildSearchQuery(
      db,
      {
        q: 'wood',
        page: 1,
        pageSize: 20,
      },
      { count: true },
    );

    const sql = query.toSQL();
    expect(sql.sql).toContain('count(`s`.`id`) as `count`');
  });
});
