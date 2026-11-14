// tests/helpers.js — Test setup and utility helpers
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/index');
const pool = require('../src/db/pool');
const { generateToken } = require('../src/middleware/auth');

async function createTestUser({
  email = `test_${Date.now()}_${Math.floor(Math.random() * 1000)}@university.edu`,
  fullName = 'Test Student',
  password = 'Password123!',
  role = 'USER',
  verified = true,
} = {}) {
  const hash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, verified, status)
     VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
     RETURNING *`,
    [fullName, email, hash, role, verified]
  );
  const user = result.rows[0];
  const token = generateToken(user.id);
  return { user, token, rawPassword: password };
}

async function cleanupUser(userId) {
  try {
    await pool.query('DELETE FROM item_requests WHERE buyer_id = $1 OR seller_id = $1', [userId]);
    await pool.query('DELETE FROM listings WHERE seller_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  } catch (_) {}
}

process.on('beforeExit', async () => {
  try {
    await pool.end();
  } catch (_) {}
});

module.exports = {
  app,
  pool,
  request,
  createTestUser,
  cleanupUser,
};
