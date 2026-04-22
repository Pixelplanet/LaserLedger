import knex, { type Knex } from 'knex';
import config from './knexfile.js';

const profile = process.env.DB_PROFILE || (process.env.APP_ENV === 'automated-test' ? 'test' : 'production');
const cfg = config[profile] ?? config.production!;

export const db: Knex = knex(cfg);

export type DB = typeof db;

export const isMySQL = (): boolean => db.client.config.client === 'mysql2';
export const isSQLite = (): boolean => db.client.config.client === 'better-sqlite3';
