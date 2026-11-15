// tests/requests_inventory.test.js — Request Handling, Inventory Locking & Mutual Confirmation
const { test, describe, after, before } = require('node:test');
const assert = require('node:assert/strict');
const { app, pool, request, createTestUser, cleanupUser } = require('./helpers');

describe('Request Workflow, Stock Concurrency & Mutual Confirmation', () => {
  let seller;
  let buyerA;
  let buyerB;
  let listingId;
  const createdRequestIds = [];

  before(async () => {
    seller = await createTestUser({ verified: true, fullName: 'Seller Student' });
    buyerA = await createTestUser({ verified: true, fullName: 'Buyer Alice' });
    buyerB = await createTestUser({ verified: true, fullName: 'Buyer Bob' });

    const catRes = await pool.query('SELECT id FROM categories WHERE active = TRUE LIMIT 1');
    const categoryId = catRes.rows[0].id;

    // Create a listing with exactly 1 unit available
    const listingRes = await pool.query(
      `INSERT INTO listings (seller_id, category_id, title, description, item_condition, transaction_type, qty_total, qty_available, qty_reserved, price, status)
       VALUES ($1, $2, 'Single Unit Lab Coat', 'Only 1 unit in stock', 'GOOD', 'SELL', 1, 1, 0, 250, 'AVAILABLE')
       RETURNING id`,
      [seller.user.id, categoryId]
    );
    listingId = listingRes.rows[0].id;
  });

  after(async () => {
    for (const rid of createdRequestIds) {
      await pool.query('DELETE FROM exchange_confirmations WHERE request_id = $1', [rid]);
      await pool.query('DELETE FROM item_requests WHERE id = $1', [rid]);
    }
    await pool.query('DELETE FROM listings WHERE id = $1', [listingId]);
    await cleanupUser(seller.user.id);
    await cleanupUser(buyerA.user.id);
    await cleanupUser(buyerB.user.id);
    await pool.end();
  });

  test('POST /api/v1/requests — Prevents seller from requesting their own item', async () => {
    const res = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${seller.token}`)
      .send({
        listingId,
        quantity: 1,
        note: 'Self request attempt',
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /cannot request your own listing/i);
  });

  test('POST /api/v1/requests — Prevents requesting more quantity than available', async () => {
    const res = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${buyerA.token}`)
      .send({
        listingId,
        quantity: 5, // Only 1 available
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /only 1 unit/i);
  });

  test('POST /api/v1/requests — Buyer A submits request for 1 available unit (PENDING)', async () => {
    const res = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${buyerA.token}`)
      .send({
        listingId,
        quantity: 1,
        note: 'Hi, can I pick this up tomorrow?',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'PENDING');
    assert.equal(res.body.data.quantity, 1);
    createdRequestIds.push(res.body.data.id);
  });

  test('PATCH /api/v1/requests/:id/accept — Seller accepts Buyer A request (Atomic Stock Reservation)', async () => {
    const reqId = createdRequestIds[0];
    const res = await request(app)
      .patch(`/api/v1/requests/${reqId}/accept`)
      .set('Authorization', `Bearer ${seller.token}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.status, 'ACCEPTED');

    // Verify database row lock reserved stock properly
    const checkStock = await pool.query('SELECT qty_available, qty_reserved FROM listings WHERE id = $1', [
      listingId,
    ]);
    assert.equal(checkStock.rows[0].qty_available, 0, 'Available stock should now be 0');
    assert.equal(checkStock.rows[0].qty_reserved, 1, 'Reserved stock should now be 1');
  });

  test('POST /api/v1/requests — Prevents Buyer B from requesting already reserved out-of-stock item', async () => {
    const res = await request(app)
      .post('/api/v1/requests')
      .set('Authorization', `Bearer ${buyerB.token}`)
      .send({
        listingId,
        quantity: 1,
      });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
  });

  test('PATCH /api/v1/requests/:id/confirm-completion — Requires mutual confirmation from BOTH parties', async () => {
    const reqId = createdRequestIds[0];

    // 1. Buyer confirms first
    const buyerConfirmRes = await request(app)
      .patch(`/api/v1/requests/${reqId}/confirm-completion`)
      .set('Authorization', `Bearer ${buyerA.token}`);

    assert.equal(buyerConfirmRes.status, 200);
    assert.equal(buyerConfirmRes.body.success, true);
    assert.equal(buyerConfirmRes.body.data.hasCurrentUserConfirmed, true);
    assert.equal(buyerConfirmRes.body.data.status, 'ACCEPTED', 'Status should remain ACCEPTED until peer confirms');

    // 2. Duplicate confirmation by same party is rejected
    const dupRes = await request(app)
      .patch(`/api/v1/requests/${reqId}/confirm-completion`)
      .set('Authorization', `Bearer ${buyerA.token}`);

    assert.equal(dupRes.status, 409);
    assert.match(dupRes.body.message, /already submitted confirmation/i);

    // 3. Seller confirms -> Exchange finalized!
    const sellerConfirmRes = await request(app)
      .patch(`/api/v1/requests/${reqId}/confirm-completion`)
      .set('Authorization', `Bearer ${seller.token}`);

    assert.equal(sellerConfirmRes.status, 200);
    assert.equal(sellerConfirmRes.body.success, true);
    assert.equal(sellerConfirmRes.body.data.status, 'COMPLETED', 'Status should be COMPLETED upon mutual confirmation');

    // 4. Verify permanent stock reduction
    const finalStock = await pool.query('SELECT qty_total, qty_reserved, qty_available, status FROM listings WHERE id = $1', [
      listingId,
    ]);
    assert.equal(finalStock.rows[0].qty_total, 0, 'Total stock should now be 0 for permanent sale');
    assert.equal(finalStock.rows[0].qty_reserved, 0, 'Reserved stock should be released');
    assert.equal(finalStock.rows[0].status, 'COMPLETED');
  });
});
