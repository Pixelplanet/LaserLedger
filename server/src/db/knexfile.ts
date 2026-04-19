import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Knex } from 'knex';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const migrationsDir = path.join(__dirname, 'migrations');
const seedsDir = path.join(__dirname, 'seeds');

const mysqlConnection: Knex.MySqlConnectionConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'laserledger',
  user: process.env.DB_USER || 'laserledger',
  password: process.env.DB_PASSWORD || '',
  timezone: 'Z',
  typeCast(field: any, next: () => unknown) {
    if (field.type === 'TINY' && field.length === 1) {
      const v = field.string();
      return v === null ? null : v === '1';
    }
    return next();
  },
};

const mysqlBase: Knex.Config = {
  client: 'mysql2',
  connection: mysqlConnection,
  pool: { min: 0, max: 10 },
  migrations: { directory: migrationsDir, extension: 'ts' },
  seeds: { directory: seedsDir, extension: 'ts' },
};

const sqliteTest: Knex.Config = {
  client: 'better-sqlite3',
  connection: { filename: ':memory:' },
  useNullAsDefault: true,
  migrations: { directory: migrationsDir, extension: 'ts' },
  seeds: { directory: seedsDir, extension: 'ts' },
};

const config: Record<string, Knex.Config> = {
  development: mysqlBase,
  production: mysqlBase,
  test: sqliteTest,
  test_mysql: {
    ...mysqlBase,
    connection: {
      ...mysqlConnection,
      database: process.env.DB_NAME || 'laserledger_test',
    },
    pool: { min: 0, max: 5 },
  },
};

export default config;
