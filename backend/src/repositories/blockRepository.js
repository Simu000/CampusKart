// repositories/blockRepository.js — All DB queries for blocked users
const pool = require('../db/pool');

async function block(blockerId, blockedUserId) {
  await pool.query(
    `INSERT INTO blocked_users (blocker_id, blocked_user_id)
     VALUES ($1, $2)
     ON CONFLICT (blocker_id, blocked_user_id) DO NOTHING`,
    [blockerId, blockedUserId]
  );
}

async function unblock(blockerId, blockedUserId) {
  await pool.query(
    'DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_user_id = $2',
    [blockerId, blockedUserId]
  );
}

async function isBlocked(blockerId, blockedUserId) {
  const r = await pool.query(
    'SELECT id FROM blocked_users WHERE blocker_id = $1 AND blocked_user_id = $2',
    [blockerId, blockedUserId]
  );
  return r.rows.length > 0;
}

async function isEitherBlocked(userA, userB) {
  const r = await pool.query(
    `SELECT id FROM blocked_users
     WHERE (blocker_id = $1 AND blocked_user_id = $2)
        OR (blocker_id = $2 AND blocked_user_id = $1)`,
    [userA, userB]
  );
  return r.rows.length > 0;
}

async function getBlockedList(blockerId) {
  const r = await pool.query(
    `SELECT u.id, u.full_name, u.department, u.profile_image_url, bu.created_at AS blocked_at
     FROM blocked_users bu
     JOIN users u ON u.id = bu.blocked_user_id
     WHERE bu.blocker_id = $1
     ORDER BY bu.created_at DESC`,
    [blockerId]
  );
  return r.rows;
}

module.exports = { block, unblock, isBlocked, isEitherBlocked, getBlockedList };
