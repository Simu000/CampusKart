// routes/reports.js — Report & Block routes
const express = require('express');
const { authenticate, requireVerified } = require('../middleware/auth');
const {
  createReport,
  blockUser,
  unblockUser,
  getBlockedList,
} = require('../controllers/reportController');

const router = express.Router();

// Report a listing or user
router.post('/', authenticate, requireVerified, createReport);

module.exports = router;
