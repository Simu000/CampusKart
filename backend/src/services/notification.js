// src/services/notification.js — In-app notification service
const pool = require('../db/pool');

async function sendNotification(userId, type, title, body, referenceType = null, referenceId = null) {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, title, body, reference_type, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, type, title, body, referenceType, referenceId]
    );
    return result.rows[0];
  } catch (err) {
    console.error('[NOTIFICATION] Failed to send notification:', err.message);
    return null;
  }
}

async function getUserNotifications(userId) {
  const result = await pool.query(
    `SELECT id, type, title, body, reference_type, reference_id, is_read, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows.map(n => ({
    id: Number(n.id),
    type: n.type,
    title: n.title,
    body: n.body,
    referenceType: n.reference_type,
    referenceId: n.reference_id ? Number(n.reference_id) : null,
    isRead: n.is_read,
    createdAt: n.created_at,
  }));
}

async function getUnreadCount(userId) {
  const result = await pool.query(
    'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

async function markRead(notificationId, userId) {
  await pool.query(
    'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
    [notificationId, userId]
  );
}

async function markAllRead(userId) {
  await pool.query(
    'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
    [userId]
  );
}

module.exports = {
  sendNotification,
  getUserNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
};
