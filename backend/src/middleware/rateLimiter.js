// middleware/rateLimiter.js — Rate limiting for sensitive routes
const rateLimit = require('express-rate-limit');

const windowMs = 15 * 60 * 1000; // 15 minutes

// General API rate limit
const generalLimiter = rateLimit({
  windowMs,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

// Strict limit for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts. Please wait 15 minutes before trying again.' },
});

// Moderate limit for email actions
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many email requests. Please wait an hour before trying again.' },
});

// Limit for creating requests/messages (prevent spam)
const actionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

module.exports = { generalLimiter, authLimiter, emailLimiter, actionLimiter };
