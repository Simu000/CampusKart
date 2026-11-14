// tests/messaging.test.js — Private Messaging & Access Control Test Suite
const { test, describe, after, before } = require('node:test');
const assert = require('node:assert/strict');
const { app, pool, request, createTestUser, cleanupUser } = require('./helpers');

describe('Private Messaging & Access Control APIs', () => {
  let seller;
  let buyer;
  let intruder;
  let pendingRequestId;
  let acceptedRequestId;
  let listingId;

  before(async () => {
    seller = await createTestUser({ verified: true });
    buyer = await createTestUser({ verified: true });
    intruder = await createTestUser({ verified: true });

    const catRes = await pool.query('SELECT id FROM categories WHERE active = TRUE LIMIT 1');
    const categoryId = catRes.rows[0].id;

    // Create listing
    const listingRes = await pool.query(
      `INSERT INTO listings (seller_id, category_id, title, description, item_condition, transaction_type, qty_total, qty_available, qty_reserved, price, status)
       VALUES ($1, $2, 'Messaging Test Item', 'For chat testing', 'GOOD', 'SELL', 5, 5, 0, 100, 'AVAILABLE')
       RETURNING id`,
      [seller.user.id, categoryId]
    );
    listingId = listingRes.rows[0].id;

    // Create a PENDING request
    const pendingReqRes = await pool.query(
      `INSERT INTO item_requests (listing_id, buyer_id, seller_id, quantity, status, expires_at)
       VALUES ($1, $2, $3, 1, 'PENDING', NOW() + INTERVAL '3 days')
       RETURNING id`,
      [listingId, buyer.user.id, seller.user.id]
    );
    pendingRequestId = pendingReqRes.rows[0].id;

    // Create an ACCEPTED request
    const acceptedReqRes = await pool.query(
      `INSERT INTO item_requests (listing_id, buyer_id, seller_id, quantity, status, expires_at)
       VALUES ($1, $2, $3, 1, 'ACCEPTED', NOW() + INTERVAL '3 days')
       RETURNING id`,
      [listingId, buyer.user.id, seller.user.id]
    );
    acceptedRequestId = acceptedReqRes.rows[0].id;
  });

  after(async () => {
    await pool.query('DELETE FROM messages WHERE request_id IN ($1, $2)', [
      pendingRequestId,
      acceptedRequestId,
    ]);
    await pool.query('DELETE FROM item_requests WHERE id IN ($1, $2)', [
      pendingRequestId,
      acceptedRequestId,
    ]);
    await pool.query('DELETE FROM listings WHERE id = $1', [listingId]);
    await cleanupUser(seller.user.id);
    await cleanupUser(buyer.user.id);
    await cleanupUser(intruder.user.id);
  });

  test('GET /api/v1/requests/:id/messages — Rejects chat access while request is PENDING', async () => {
    const res = await request(app)
      .get(`/api/v1/requests/${pendingRequestId}/messages`)
      .set('Authorization', `Bearer ${buyer.token}`);

    assert.equal(res.status, 403);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /only after the seller accepts/i);
  });

  test('GET /api/v1/requests/:id/messages — Forbids unrelated third-party student from accessing chat', async () => {
    const res = await request(app)
      .get(`/api/v1/requests/${acceptedRequestId}/messages`)
      .set('Authorization', `Bearer ${intruder.token}`);

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });

  test('POST /api/v1/requests/:id/messages — Sends message successfully between accepted participants', async () => {
    const res = await request(app)
      .post(`/api/v1/requests/${acceptedRequestId}/messages`)
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({
        body: 'Hello! Are you free to meet near the library today?',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.body, 'Hello! Are you free to meet near the library today?');
    assert.equal(Number(res.body.data.senderId), Number(buyer.user.id));
  });

  test('POST /api/v1/requests/:id/messages — Rejects empty message', async () => {
    const res = await request(app)
      .post(`/api/v1/requests/${acceptedRequestId}/messages`)
      .set('Authorization', `Bearer ${seller.token}`)
      .send({
        body: '   ',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /cannot be empty/i);
  });

  test('GET /api/v1/requests/:id/messages — Retrieves chronological message thread for seller', async () => {
    const res = await request(app)
      .get(`/api/v1/requests/${acceptedRequestId}/messages`)
      .set('Authorization', `Bearer ${seller.token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length >= 1);
    assert.equal(res.body.data[0].body, 'Hello! Are you free to meet near the library today?');
  });

  test('GET /api/v1/conversations — Lists conversation threads for participant', async () => {
    const res = await request(app)
      .get('/api/v1/conversations')
      .set('Authorization', `Bearer ${buyer.token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });
});
