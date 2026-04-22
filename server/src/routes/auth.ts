import { Router, type Request } from 'express';
import { db } from '../db/index.js';
import { hashPassword, verifyPassword, signToken, COOKIE_NAME, cookieOptions } from '../auth/tokens.js';
import { hexId, nowIso, token as makeToken } from '../utils/ids.js';
import { validate } from '../middleware/validate.js';
import { requireAuthAny } from '../middleware/auth.js';
import {
  RegisterInput,
  LoginInput,
  GoogleLoginInput,
  ProfileUpdateInput,
  PasswordResetRequestInput,
  PasswordResetInput,
  type PasswordResetInput as PasswordResetInputType,
} from '@shared/schemas.js';
import {
  sendEmail,
  emailVerificationMessage,
  passwordResetMessage,
  welcomeMessage,
  isEmailTransportConfigured,
} from '../services/email.js';
import { env } from '../config.js';
import { AppError, badRequest, conflict, notFound, unauthorized } from '../utils/errors.js';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import type { User } from '@shared/types.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
});

const registerLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  skip: () => env.NODE_ENV === 'test',
});

function publicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    display_name: u.display_name,
    role: u.role,
    email_verified: u.email_verified,
    bio: u.bio,
    avatar_url: u.avatar_url,
    timezone: u.timezone,
    cloudify_user_id: u.cloudify_user_id,
    submission_count: u.submission_count,
    reputation: u.reputation,
    created_at: u.created_at,
  };
}

// ─── Register ──────────────────────────────────────────────────────────────
router.post('/register', registerLimiter, validate(RegisterInput), async (req, res, next) => {
  try {
    const input = req.body as RegisterInput;
    const existing = await db('users').where({ email: input.email }).first();
    if (existing) throw conflict('An account with that email already exists');
    const now = nowIso();
    const id = hexId();
    await db('users').insert({
      id,
      email: input.email,
      display_name: input.display_name,
      password_hash: await hashPassword(input.password),
      google_id: null,
      role: 'user',
      email_verified: false,
      cloudify_user_id: null,
      timezone: input.timezone ?? null,
      bio: null,
      avatar_url: null,
      submission_count: 0,
      reputation: 0,
      created_at: now,
      updated_at: now,
      last_login_at: null,
    });
    // Email verification token
    const tok = makeToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await db('email_verification_tokens').insert({
      token: tok,
      user_id: id,
      expires_at: expiresAt,
      used: false,
    });
    await sendEmail(emailVerificationMessage(input.email, `${env.APP_BASE_URL}/verify-email/${tok}`));
    const user = (await db<User>('users').where({ id }).first())!;
    res
      .cookie(COOKIE_NAME, signToken({ sub: user.id, role: user.role }), cookieOptions())
      .status(201)
      .json({ data: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

// ─── Login ─────────────────────────────────────────────────────────────────
router.post('/login', loginLimiter, validate(LoginInput), async (req, res, next) => {
  try {
    const input = req.body as LoginInput;
    const user = await db<User>('users').where({ email: input.email }).first();
    if (!user || !user.password_hash) throw unauthorized('Invalid credentials');
    const ok = await verifyPassword(input.password, user.password_hash);
    if (!ok) throw unauthorized('Invalid credentials');
    await db('users').where({ id: user.id }).update({ last_login_at: nowIso(), updated_at: nowIso() });
    res.cookie(COOKIE_NAME, signToken({ sub: user.id, role: user.role }), cookieOptions());
    res.json({ data: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

// ─── Google OAuth ──────────────────────────────────────────────────────────
let googleClient: OAuth2Client | null = null;
function getGoogleClient(): OAuth2Client {
  if (!googleClient) googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID || undefined);
  return googleClient;
}

router.post('/google', validate(GoogleLoginInput), async (req, res, next) => {
  try {
    if (!env.GOOGLE_CLIENT_ID) throw badRequest('Google OAuth not configured');
    const { id_token } = req.body as GoogleLoginInput;
    const ticket = await getGoogleClient().verifyIdToken({
      idToken: id_token,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) throw unauthorized('Invalid Google token');
    const sub = payload.sub;
    const email = payload.email.toLowerCase();
    let user = await db<User>('users').where({ google_id: sub }).first();
    if (!user) {
      // Try to link by email
      user = await db<User>('users').where({ email }).first();
      if (user) {
        await db('users').where({ id: user.id }).update({ google_id: sub, updated_at: nowIso() });
      }
    }
    if (!user) {
      const id = hexId();
      const now = nowIso();
      await db('users').insert({
        id,
        email,
        display_name: payload.name || email.split('@')[0],
        password_hash: null,
        google_id: sub,
        role: 'user',
        email_verified: true,
        cloudify_user_id: null,
        timezone: null,
        bio: null,
        avatar_url: payload.picture ?? null,
        submission_count: 0,
        reputation: 0,
        created_at: now,
        updated_at: now,
        last_login_at: now,
      });
      user = (await db<User>('users').where({ id }).first())!;
    }
    res.cookie(COOKIE_NAME, signToken({ sub: user.id, role: user.role }), cookieOptions());
    res.json({ data: publicUser(user) });
  } catch (e) {
    next(e);
  }
});

// ─── Logout ────────────────────────────────────────────────────────────────
router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.status(204).end();
});

// ─── Me ────────────────────────────────────────────────────────────────────
router.get('/me', (req: Request, res) => {
  if (!req.user) {
    res.json({ data: null });
    return;
  }
  res.json({ data: publicUser(req.user) });
});

// ─── Verify email ──────────────────────────────────────────────────────────
router.post('/verify-email', async (req, res, next) => {
  try {
    const tok = String((req.body as Record<string, unknown>)?.token ?? '');
    if (!tok) throw badRequest('Missing token');
    const row = await db('email_verification_tokens').where({ token: tok }).first();
    if (!row || row.used) throw badRequest('Invalid or used token');
    if (new Date(row.expires_at) < new Date()) throw badRequest('Token expired');
    await db('users').where({ id: row.user_id }).update({ email_verified: true, updated_at: nowIso() });
    await db('email_verification_tokens').where({ token: tok }).update({ used: true });
    const user = await db<User>('users').where({ id: row.user_id }).first();
    if (user) await sendEmail(welcomeMessage(user.email, user.display_name));
    res.json({ data: { verified: true } });
  } catch (e) {
    next(e);
  }
});

// ─── Resend verification ───────────────────────────────────────────────────
router.post('/resend-verification', requireAuthAny, async (req, res, next) => {
  try {
    const user = req.user!;
    if (user.email_verified) throw badRequest('Already verified');
    const tok = makeToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await db('email_verification_tokens').insert({
      token: tok,
      user_id: user.id,
      expires_at: expiresAt,
      used: false,
    });
    await sendEmail(emailVerificationMessage(user.email, `${env.APP_BASE_URL}/verify-email/${tok}`));
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ─── Request password reset ────────────────────────────────────────────────
router.post('/request-reset', validate(PasswordResetRequestInput), async (req, res, next) => {
  try {
    if (env.NODE_ENV === 'production' && !isEmailTransportConfigured()) {
      throw new AppError(503, 'email_unavailable', 'Password reset email is currently unavailable');
    }
    const { email } = req.body as { email: string };
    const user = await db<User>('users').where({ email }).first();
    // Always return 204 to avoid leaking whether email exists
    if (user) {
      const tok = makeToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
      await db('password_reset_tokens').insert({
        token: tok,
        user_id: user.id,
        expires_at: expiresAt,
        used: false,
      });
      await sendEmail(passwordResetMessage(user.email, `${env.APP_BASE_URL}/reset-password/${tok}`));
    }
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ─── Reset password ────────────────────────────────────────────────────────
router.post('/reset-password', validate(PasswordResetInput), async (req, res, next) => {
  try {
    const { token: tok, new_password } = req.body as PasswordResetInputType;
    const row = await db('password_reset_tokens').where({ token: tok }).first();
    if (!row || row.used) throw badRequest('Invalid or used token');
    if (new Date(row.expires_at) < new Date()) throw badRequest('Token expired');
    await db('users')
      .where({ id: row.user_id })
      .update({ password_hash: await hashPassword(new_password), updated_at: nowIso() });
    await db('password_reset_tokens').where({ token: tok }).update({ used: true });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ─── Update profile ────────────────────────────────────────────────────────
router.patch('/profile', requireAuthAny, validate(ProfileUpdateInput), async (req, res, next) => {
  try {
    const user = req.user!;
    const update = { ...(req.body as ProfileUpdateInput), updated_at: nowIso() };
    await db('users').where({ id: user.id }).update(update);
    const fresh = (await db<User>('users').where({ id: user.id }).first())!;
    res.json({ data: publicUser(fresh) });
  } catch (e) {
    next(e);
  }
});

// ─── GDPR data export ──────────────────────────────────────────────────────
router.get('/export-data', requireAuthAny, async (req, res, next) => {
  try {
    const user = req.user!;
    const settings = await db('laser_settings').where({ submitted_by: user.id });
    const votes = await db('votes').where({ user_id: user.id });
    const comments = await db('comments').where({ user_id: user.id });
    const bookmarks = await db('user_bookmarks').where({ user_id: user.id });
    const images = await db('setting_images').where({ uploaded_by: user.id });
    res.json({
      data: { user: publicUser(user), settings, votes, comments, bookmarks, images },
    });
  } catch (e) {
    next(e);
  }
});

// ─── GDPR account deletion ─────────────────────────────────────────────────
router.delete('/account', requireAuthAny, async (req, res, next) => {
  try {
    const user = req.user!;
    // Anonymize content rather than cascading delete (preserves community knowledge)
    await db.transaction(async (trx) => {
      // Soft delete content tied to this user
      await trx('comments').where({ user_id: user.id }).update({ is_deleted: true, body: '[deleted]' });
      // Anonymize user record
      await trx('users')
        .where({ id: user.id })
        .update({
          email: `deleted-${user.id}@deleted.invalid`,
          display_name: '[deleted]',
          password_hash: null,
          google_id: null,
          bio: null,
          avatar_url: null,
          cloudify_user_id: null,
          updated_at: nowIso(),
        });
    });
    res.clearCookie(COOKIE_NAME, { path: '/' });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// ─── Cloudify account linking ──────────────────────────────────────────────
router.post('/link-cloudify', requireAuthAny, async (req, res, next) => {
  try {
    const user = req.user!;
    const cloudifyEmail = String((req.body as Record<string, unknown>)?.email ?? '')
      .toLowerCase()
      .trim();
    if (!cloudifyEmail) throw badRequest('Missing Cloudify email');
    // Stub: in production, call Cloudify API to verify ownership.
    // For now, store a pending link tied to the user's email match.
    const fakeCloudifyId = hexId();
    await db('users')
      .where({ id: user.id })
      .update({ cloudify_user_id: fakeCloudifyId, updated_at: nowIso() });
    res.json({ data: { linked: true, cloudify_user_id: fakeCloudifyId } });
  } catch (e) {
    next(e);
  }
});

export default router;
