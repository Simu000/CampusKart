// src/routes/notifications.js — Student in-app notifications
const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  getUserNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} = require('../services/notification');

const router = express.Router();

// ── GET /api/v1/notifications ────────────────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const [items, unreadCount] = await Promise.all([
      getUserNotifications(req.userId),
      getUnreadCount(req.userId),
    ]);

    res.json({
      success: true,
      data: {
        items,
        unreadCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/v1/notifications/:id/read ──────────────────────────────────────
router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    await markRead(req.params.id, req.userId);
    res.json({
      success: true,
      message: 'Notification marked as read',
      data: null,
    });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/v1/notifications/read-all ──────────────────────────────────────
router.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    await markAllRead(req.userId);
    res.json({
      success: true,
      message: 'All notifications marked as read',
      data: null,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
