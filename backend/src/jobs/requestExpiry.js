// src/jobs/requestExpiry.js — Background task to expire stale requests (every 5 mins)
const cron = require('node-cron');
const pool = require('../db/pool');

function startRequestExpiryJob() {
  // Run every 5 minutes: '*/5 * * * *'
  cron.schedule('*/5 * * * *', async () => {
    try {
      const now = new Date();
      const result = await pool.query(
        `UPDATE item_requests
         SET status = 'EXPIRED', updated_at = NOW()
         WHERE status = 'PENDING' AND expires_at < $1
         RETURNING id, listing_id`,
        [now]
      );

      if (result.rows.length > 0) {
        console.log(`[CRON] Expired ${result.rows.length} exchange request(s) exceeding 72-hour window.`);
        result.rows.forEach(r => {
          console.log(`  → Request #${r.id} for listing #${r.listing_id} has expired due to seller inactivity.`);
        });
      }
    } catch (err) {
      console.error('[CRON] Error expiring stale requests:', err.message);
    }
  });

  console.log('⏰ Request expiry task scheduled (fixed interval: 5 minutes)');
}

module.exports = { startRequestExpiryJob };
