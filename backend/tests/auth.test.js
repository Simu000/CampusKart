// tests/auth.test.js — Authentication and Verification Test Suite
const { test, describe, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, pool, request, createTestUser, cleanupUser } = require('./helpers');

describe('Authentication & User Management APIs', () => {
  const createdUserIds = [];

  after(async () => {
    for (const id of createdUserIds) {
      await cleanupUser(id);
    }
    await pool.end();
  });

  test('POST /api/v1/auth/register — Succeeds with approved university email domain (does not expose verification link)', async () => {
    const testEmail = `student_${Date.now()}@chitkara.edu.in`;
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Aarav Mehta',
        email: testEmail,
        password: 'ValidPassword123!',
        department: 'Computer Science',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.email, testEmail);
    assert.equal(res.body.data.user.verified, false);
    assert.equal(res.body.data.verificationLink, undefined);
    createdUserIds.push(res.body.data.user.id);
  });

  test('POST /api/v1/auth/login — Rejects login if email is unverified', async () => {
    const { user, rawPassword } = await createTestUser({ verified: false });
    createdUserIds.push(user.id);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: user.email,
        password: rawPassword,
      });

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /not verified/i);
  });

  test('POST /api/v1/auth/register — Rejects unapproved email domain (e.g. gmail.com)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Fake Student',
        email: `fake_${Date.now()}@gmail.com`,
        password: 'ValidPassword123!',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /approved university email/i);
  });

  test('POST /api/v1/auth/register — Rejects unapproved non-chitkara university domain (e.g. university.edu)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Other Student',
        email: `student_${Date.now()}@university.edu`,
        password: 'ValidPassword123!',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /approved university email/i);
  });

  test('POST /api/v1/auth/register — Rejects duplicate email registration', async () => {
    const { user } = await createTestUser();
    createdUserIds.push(user.id);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Duplicate Student',
        email: user.email,
        password: 'ValidPassword123!',
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /already exists/i);
  });

  test('POST /api/v1/auth/register — Rejects short password (< 8 chars)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Short Pass',
        email: `short_${Date.now()}@chitkara.edu.in`,
        password: '123',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /at least 8 characters/i);
  });

  test('POST /api/v1/auth/login — Logs in successfully with correct credentials', async () => {
    const { user, rawPassword } = await createTestUser({ verified: true });
    createdUserIds.push(user.id);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: user.email,
        password: rawPassword,
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.token, 'Should return authentication token');
    assert.equal(res.body.data.user.email, user.email);
  });

  test('POST /api/v1/auth/login — Rejects incorrect password', async () => {
    const { user } = await createTestUser();
    createdUserIds.push(user.id);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: user.email,
        password: 'WrongPassword999!',
      });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /(incorrect|invalid) email or password/i);
  });

  test('GET /api/v1/auth/me — Retrieves profile when authenticated with Bearer token', async () => {
    const { user, token } = await createTestUser();
    createdUserIds.push(user.id);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(Number(res.body.data.id), Number(user.id));
    assert.equal(res.body.data.email, user.email);
  });

  test('GET /api/v1/auth/me — Rejects request without authentication', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });
});
