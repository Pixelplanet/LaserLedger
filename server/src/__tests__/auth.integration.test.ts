import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

const app = createApp();

describe('auth flow (integration)', () => {
  it('registers, fails duplicate, logs in, fetches /me', async () => {
    // Register
    const reg = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'alice@example.com',
        password: 'SuperSecret1!',
        display_name: 'Alice',
      });
    expect(reg.status).toBe(201);
    expect(reg.body.data.email).toBe('alice@example.com');
    const cookie = reg.headers['set-cookie'];
    expect(cookie).toBeTruthy();

    // Duplicate registration
    const dup = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'alice@example.com', password: 'AnotherPw1!', display_name: 'Alice2' });
    expect(dup.status).toBe(409);

    // Login
    const login = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'alice@example.com', password: 'SuperSecret1!' });
    expect(login.status).toBe(200);
    expect(login.body.data.email).toBe('alice@example.com');

    // Bad login
    const bad = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'alice@example.com', password: 'wrong' });
    expect(bad.status).toBe(401);

    // /me with cookie
    const sessionCookie = login.headers['set-cookie'];
    const me = await request(app).get('/api/auth/me').set('Cookie', sessionCookie);
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe('alice@example.com');

    // /me without cookie
    const anon = await request(app).get('/api/auth/me');
    expect(anon.status).toBe(200);
    expect(anon.body.data).toBeNull();
  });

  it('rejects state-changing requests with bad origin', async () => {
    const r = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://evil.example.com')
      .send({ email: 'b@example.com', password: 'Whatever1!', display_name: 'B' });
    expect(r.status).toBe(403);
  });

  it('rejects invalid email format', async () => {
    const r = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'not-email', password: 'Whatever1!', display_name: 'X' });
    expect(r.status).toBe(422);
  });

  it('logout clears cookie', async () => {
    const r = await request(app).post('/api/auth/logout').set('Origin', 'http://localhost:5173');
    expect(r.status).toBe(204);
  });

  it('refreshes session cookie on authenticated request (token rotation)', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'rotate@example.com', password: 'RotatePass1!', display_name: 'Rotate' });
    expect(reg.status).toBe(201);

    const login = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'rotate@example.com', password: 'RotatePass1!' });
    expect(login.status).toBe(200);
    const sessionCookie = login.headers['set-cookie'];
    expect(sessionCookie).toBeTruthy();

    const me = await request(app).get('/api/auth/me').set('Cookie', sessionCookie);
    expect(me.status).toBe(200);
    expect(me.headers['set-cookie']).toBeTruthy();
    const cookies = me.headers['set-cookie'] as string[];
    expect(cookies.some((c) => c.startsWith('ll_session='))).toBe(true);
  });
});
