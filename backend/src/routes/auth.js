// src/routes/auth.js — Authentication & account management
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { authenticate, generateToken, attachAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { hashToken, sendVerificationEmail, sendPasswordResetEmail } = require('../services/email');
const { BadRequestError, ConflictError, UnauthorizedError, NotFoundError } = require('../middleware/errors');

const router = express.Router();

function toUserSummaryDto(user) {
  return {
    id: Number(user.id),
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    verified: Boolean(user.verified),
    department: user.department || null,
    profileImageUrl: user.profile_image_url || null,
  };
}

// ── POST /api/v1/auth/register ────────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { fullName, email, password, department, course, studyYear } = req.body;

    if (!fullName || !email || !password) {
      throw new BadRequestError('Full name, email, and password are required');
    }

    if (password.length < 8) {
      throw new BadRequestError('Password must be at least 8 characters');
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check allowed domains if specified
    const rawDomains = process.env.UNIVERSITY_EMAIL_DOMAINS || '';
    const allowedDomains = rawDomains
      .split(',')
      .map(d => d.trim().toLowerCase())
      .filter(Boolean);

    if (allowedDomains.length > 0) {
      const atIndex = normalizedEmail.indexOf('@');
      const domain = atIndex !== -1 ? normalizedEmail.substring(atIndex + 1) : '';
      const isAllowed = allowedDomains.some(d => domain === d || domain.endsWith('.' + d));

      if (!isAllowed) {
        throw new BadRequestError(`Please register with an approved university email address (@${allowedDomains.join(', @')})`);
      }
    }

    // Check existing email
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      throw new ConflictError('An account with this email address already exists');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const userResult = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, department, course, study_year, verified)
       VALUES ($1, $2, $3, $4, $5, $6, FALSE)
       RETURNING *`,
      [
        fullName.trim(),
        normalizedEmail,
        passwordHash,
        department ? department.trim() : null,
        course ? course.trim() : null,
        studyYear ? studyYear.trim() : null,
      ]
    );

    const newUser = userResult.rows[0];

    // Dispatch verification email to student's inbox
    try {
      await sendVerificationEmail(newUser);
    } catch (err) {
      console.error('[AUTH] Failed to dispatch verification email on register:', err.message);
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful. A verification link has been sent to your university email. Please verify your email before signing in.',
      data: {
        user: toUserSummaryDto(newUser),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/login ───────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect email or password',
      });
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError('This account is currently suspended. Please contact campus support.');
    }

    if (!user.verified) {
      return res.status(403).json({
        success: false,
        message: 'Your university email is not verified yet. Please check your university email inbox and click the verification link before signing in.',
        unverified: true,
        email: user.email,
      });
    }

    const token = generateToken(user.id);
    attachAuthCookie(res, token);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: toUserSummaryDto(user),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/auth/verify-email?token=xyz ──────────────────────────────────
router.get('/verify-email', async (req, res, next) => {
  try {
    const rawToken = req.query.token;
    if (!rawToken || !rawToken.trim()) {
      throw new BadRequestError('Verification token is required');
    }

    const tokenHash = hashToken(rawToken.trim());
    const tokenResult = await pool.query(
      'SELECT * FROM email_verification_tokens WHERE token_hash = $1',
      [tokenHash]
    );
    const tokenRow = tokenResult.rows[0];

    if (!tokenRow) {
      throw new BadRequestError('Invalid or unrecognized verification token');
    }

    if (tokenRow.used_at) {
      throw new BadRequestError('This verification link has already been used');
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      throw new BadRequestError('This verification link has expired. Please request a new verification link.');
    }

    const userResult = await pool.query(
      'UPDATE users SET verified = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *',
      [tokenRow.user_id]
    );
    const user = userResult.rows[0];

    if (!user) {
      throw new BadRequestError('Associated student account not found');
    }

    await pool.query('UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1', [tokenRow.id]);

    const token = generateToken(user.id);
    attachAuthCookie(res, token);

    res.json({
      success: true,
      message: 'University email successfully verified! You now have full access to buy, sell, rent, and lend.',
      data: {
        ...toUserSummaryDto(user),
        token,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/resend-verification ─────────────────────────────────────
router.post('/resend-verification', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      throw new BadRequestError('Email address is required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    const user = result.rows[0];

    // Resend if user exists and is not verified yet
    if (user && !user.verified) {
      try {
        await sendVerificationEmail(user);
      } catch (err) {
        console.error('[AUTH] Resend verification failed:', err.message);
      }
    }

    res.json({
      success: true,
      message: 'If an unverified account exists with this email, a new verification link has been sent to your university inbox.',
      data: null,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/forgot-password ─────────────────────────────────────────
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      throw new BadRequestError('Email address is required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    const user = result.rows[0];

    if (user) {
      try {
        await sendPasswordResetEmail(user);
      } catch (err) {
        console.error('[AUTH] Forgot password email failed:', err.message);
      }
    }

    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been dispatched to your email.',
      data: null,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/reset-password ──────────────────────────────────────────
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      throw new BadRequestError('Token and new password are required');
    }
    if (newPassword.length < 8) {
      throw new BadRequestError('Password must be at least 8 characters');
    }

    const tokenHash = hashToken(token.trim());
    const tokenResult = await pool.query(
      'SELECT * FROM password_reset_tokens WHERE token_hash = $1',
      [tokenHash]
    );
    const tokenRow = tokenResult.rows[0];

    if (!tokenRow) {
      throw new BadRequestError('Invalid or unrecognized password reset token');
    }

    if (tokenRow.used_at) {
      throw new BadRequestError('This password reset link has already been used');
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      throw new BadRequestError('This password reset link has expired. Please request a new one.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const userResult = await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [passwordHash, tokenRow.user_id]
    );

    if (userResult.rows.length === 0) {
      throw new NotFoundError('Student account not found');
    }

    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [tokenRow.id]);

    res.json({
      success: true,
      message: 'Password reset successful. You may now sign in with your new password.',
      data: null,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/auth/logout ──────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({
    success: true,
    message: 'Logged out successfully',
    data: null,
  });
});

// ── GET /api/v1/auth/me ───────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ success: false, message: 'User profile not found' });
    }

    res.json({
      success: true,
      data: toUserSummaryDto(user),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
