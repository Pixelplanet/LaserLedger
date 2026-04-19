import knex, { type Knex } from 'knex';
import config from './knexfile.js';

const env = process.env.NODE_ENV || 'development';
const cfg = config[env] ?? config.development!;

export const db: Knex = knex(cfg);

export type DB = typeof db;

export const isMySQL = (): boolean => db.client.config.client === 'mysql2';
export const isSQLite = (): boolean => db.client.config.client === 'better-sqlite3';
