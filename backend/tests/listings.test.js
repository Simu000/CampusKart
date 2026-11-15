// tests/listings.test.js — Marketplace Listings & Search Test Suite
const { test, describe, after, before } = require('node:test');
const assert = require('node:assert/strict');
const { app, pool, request, createTestUser, cleanupUser } = require('./helpers');

describe('Marketplace Listings & Search APIs', () => {
  let verifiedSeller;
  let unverifiedUser;
  let categoryId;
  const createdListingIds = [];

  before(async () => {
    verifiedSeller = await createTestUser({ verified: true });
    unverifiedUser = await createTestUser({ verified: false });

    // Ensure at least one active category exists
    const catRes = await pool.query('SELECT id FROM categories WHERE active = TRUE LIMIT 1');
    if (catRes.rows.length > 0) {
      categoryId = catRes.rows[0].id;
    } else {
      const newCat = await pool.query(
        "INSERT INTO categories (name, slug, active) VALUES ('Test Category', 'test-category', TRUE) RETURNING id"
      );
      categoryId = newCat.rows[0].id;
    }
  });

  after(async () => {
    for (const lid of createdListingIds) {
      await pool.query('DELETE FROM listings WHERE id = $1', [lid]);
    }
    await cleanupUser(verifiedSeller.user.id);
    await cleanupUser(unverifiedUser.user.id);
    await pool.end();
  });

  test('GET /api/v1/categories — Returns active categories list', async () => {
    const res = await request(app).get('/api/v1/categories');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data), 'Should return an array of categories');
    assert.ok(res.body.data.length > 0, 'Categories array should not be empty');
  });

  test('GET /api/v1/listings — Returns paginated marketplace catalog', async () => {
    const res = await request(app).get('/api/v1/listings?page=0&size=10');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.items), 'Items should be an array');
    assert.equal(typeof res.body.data.total, 'number');
  });

  test('POST /api/v1/listings — Blocks unverified user from creating listings', async () => {
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${unverifiedUser.token}`)
      .send({
        title: 'Unverified Attempt',
        description: 'Should fail',
        categoryId,
        itemCondition: 'GOOD',
        transactionType: 'SELL',
        quantity: 1,
        price: 100,
      });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /verify your university email/i);
  });

  test('POST /api/v1/listings — Enforces SELL price must be greater than zero', async () => {
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${verifiedSeller.token}`)
      .send({
        title: 'Zero Price Item',
        description: 'Invalid price',
        categoryId,
        itemCondition: 'GOOD',
        transactionType: 'SELL',
        quantity: 1,
        price: 0,
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /price must be greater than zero/i);
  });

  test('POST /api/v1/listings — Creates listing successfully for verified student', async () => {
    const uniqueTitle = `Arduino Starter Kit ${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${verifiedSeller.token}`)
      .send({
        title: uniqueTitle,
        description: 'Brand new with breadboard and sensors',
        categoryId,
        itemCondition: 'NEW',
        transactionType: 'SELL',
        quantity: 3,
        price: 450,
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.title, uniqueTitle);
    assert.equal(res.body.data.qtyTotal, 3);
    assert.equal(res.body.data.qtyAvailable, 3);
    assert.equal(res.body.data.status, 'AVAILABLE');
    createdListingIds.push(res.body.data.id);
  });

  test('GET /api/v1/listings — Filters by search keyword correctly', async () => {
    const searchRes = await request(app).get('/api/v1/listings?q=Arduino&transactionType=SELL');

    assert.equal(searchRes.status, 200);
    assert.equal(searchRes.body.success, true);
    assert.ok(Array.isArray(searchRes.body.data.items || searchRes.body.data.content));
  });
});
