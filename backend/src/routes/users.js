// routes/users.js — User profile + block management
const express = require('express');
const { authenticate } = require('../middleware/auth');
const { getMe, updateMe, getPublicProfile } = require('../controllers/userController');
const { blockUser, unblockUser, getBlockedList } = require('../controllers/reportController');

const router = express.Router();

// Own profile
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateMe);

// Block management
router.get('/me/blocked', authenticate, getBlockedList);
router.post('/:id/block', authenticate, blockUser);
router.delete('/:id/block', authenticate, unblockUser);

// Public profile (unauthenticated)
router.get('/:id/public-profile', getPublicProfile);

module.exports = router;
