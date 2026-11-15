// src/db/clean.js — Wipes all dummy/demo data while preserving category taxonomy
require('dotenv').config();
const pool = require('./pool');

async function clean() {
  console.log('🧹 Cleaning database: removing all dummy data...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Drop legacy PostgreSQL chat tables if they exist
    await client.query(`
      DROP TABLE IF EXISTS messages CASCADE;
      DROP TABLE IF EXISTS conversations CASCADE;
    `);
    console.log('   ✓ Removed legacy PostgreSQL messages & conversations tables');

    // 2. Truncate all transaction and user tables with CASCADE
    await client.query(`
      TRUNCATE TABLE
        audit_logs,
        reports,
        blocked_users,
        exchange_confirmations,
        notifications,
        item_requests,
        listing_images,
        listings,
        email_verification_tokens,
        password_reset_tokens,
        users
      RESTART IDENTITY CASCADE;
    `);
    console.log('   ✓ Truncated users, listings, requests, tokens, notifications, and logs');

    // 3. Ensure the standard categories exist
    await client.query(`
      INSERT INTO categories (name, slug, display_order, active) VALUES
        ('Electronics and project components',       'electronics-and-project-components',       0, TRUE),
        ('Books and study materials',                 'books-and-study-materials',                 1, TRUE),
        ('Clothing and university merchandise',       'clothing-and-university-merchandise',       2, TRUE),
        ('Engineering equipment',                     'engineering-equipment',                     3, TRUE),
        ('Medical and nursing equipment',             'medical-and-nursing-equipment',             4, TRUE),
        ('Hotel management and culinary equipment',   'hotel-management-and-culinary-equipment',   5, TRUE),
        ('Sports and fitness equipment',              'sports-and-fitness-equipment',              6, TRUE),
        ('Other student essentials',                  'other-student-essentials',                  7, TRUE)
      ON CONFLICT (name) DO UPDATE SET active = TRUE;
    `);
    console.log('   ✓ Verified category taxonomy');

    await client.query('COMMIT');
    console.log('✨ Database wipe completed successfully. Ready for fresh, real user data!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Database cleanup failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  clean().catch(() => process.exit(1));
}

module.exports = clean;
