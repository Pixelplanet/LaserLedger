import 'dotenv/config';

function num(name: string, def: number): number {
  const v = process.env[name];
  return v === undefined || v === '' ? def : Number(v);
}

function str(name: string, def = ''): string {
  return process.env[name] ?? def;
}

export const env = {
  NODE_ENV: str('NODE_ENV', 'development'),
  PORT: num('PORT', 3000),
  APP_BASE_URL: str('APP_BASE_URL', 'http://localhost:3000'),

  DB_HOST: str('DB_HOST', 'localhost'),
  DB_PORT: num('DB_PORT', 3306),
  DB_NAME: str('DB_NAME', 'laserledger'),
  DB_USER: str('DB_USER', 'laserledger'),
  DB_PASSWORD: str('DB_PASSWORD'),

  JWT_SECRET: str('JWT_SECRET', 'dev-only-insecure-secret-change-me-please-32chars'),
  JWT_EXPIRES_IN: str('JWT_EXPIRES_IN', '7d'),
  COOKIE_NAME: 'll_session',

  GOOGLE_CLIENT_ID: str('GOOGLE_CLIENT_ID'),

  SMTP_HOST: str('SMTP_HOST'),
  SMTP_PORT: num('SMTP_PORT', 587),
  SMTP_USER: str('SMTP_USER'),
  SMTP_PASS: str('SMTP_PASS'),
  SMTP_FROM: str('SMTP_FROM', 'LaserLedger <noreply@lasertools.org>'),

  IMAGE_MODERATION_WEBHOOK_URL: str('IMAGE_MODERATION_WEBHOOK_URL'),
  IMAGE_MODERATION_WEBHOOK_TOKEN: str('IMAGE_MODERATION_WEBHOOK_TOKEN'),

  ADMIN_EMAIL: str('ADMIN_EMAIL'),
  ADMIN_INITIAL_PASSWORD: str('ADMIN_INITIAL_PASSWORD'),

  UPLOAD_DIR: str('UPLOAD_DIR', './uploads'),
  MAX_UPLOAD_SIZE: num('MAX_UPLOAD_SIZE', 5 * 1024 * 1024),
};

export const isProd = (): boolean => env.NODE_ENV === 'production';
export const isTest = (): boolean => env.NODE_ENV === 'test';
