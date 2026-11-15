// src/middleware/auth.js — JWT authentication middleware
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'campus_exchange_dev_secret_key_change_in_production_32chars';

/**
 * Extracts JWT from Authorization header or HTTP-only 'jwt_token' cookie.
 * Validates token and checks user status in database.
 */
async function authenticate(req, res, next) {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.jwt_token) {
    token = req.cookies.jwt_token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Please sign in' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const userId = Number(payload.sub);

    // Verify user exists and is active
    const userRes = await pool.query('SELECT id, status, role FROM users WHERE id = $1', [userId]);
    const user = userRes.rows[0];

    if (!user || user.status === 'SUSPENDED') {
      return res.status(401).json({
        success: false,
        message: user ? 'This account is suspended.' : 'User account no longer exists.',
      });
    }

    req.userId = userId;
    req.userRole = user.role;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid. Please sign in again.' });
  }
}

/**
 * Optional authentication: extracts user if token exists, but doesn't block.
 */
async function optionalAuth(req, res, next) {
  let token = null;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.jwt_token) {
    token = req.cookies.jwt_token;
  }

  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.userId = Number(payload.sub);
    } catch (_) {
      // Ignored for optional auth
    }
  }
  next();
}

function generateToken(userId) {
  const expiryDays = parseInt(process.env.JWT_EXPIRY_DAYS || '7', 10);
  return jwt.sign({ sub: String(userId) }, JWT_SECRET, { expiresIn: `${expiryDays}d` });
}

function attachAuthCookie(res, token) {
  const expiryDays = parseInt(process.env.JWT_EXPIRY_DAYS || '7', 10);
  res.cookie('jwt_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: expiryDays * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearAuthCookie(res) {
  res.cookie('jwt_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    maxAge: 0,
    path: '/',
  });
}

/**
 * Middleware: requires ADMIN role (must run after authenticate).
 */
function requireAdmin(req, res, next) {
  if (req.userRole !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: administrator privileges required',
    });
  }
  next();
}

/**
 * Middleware: requires verified email (must run after authenticate).
 */
async function requireVerified(req, res, next) {
  try {
    const userRes = await pool.query('SELECT verified FROM users WHERE id = $1', [req.userId]);
    const user = userRes.rows[0];
    if (!user || !user.verified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your university email to access this feature.',
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  authenticate,
  optionalAuth,
  requireAdmin,
  requireVerified,
  generateToken,
  attachAuthCookie,
  clearAuthCookie,
};
