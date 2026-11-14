// src/services/email.js — Email tokens & dispatch service
const crypto = require('crypto');
const pool = require('../db/pool');

function generateRawToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function getTransporter() {
  if (process.env.SMTP_SERVICE || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)) {
    try {
      const nodemailer = require('nodemailer');
      const user = (process.env.SMTP_USER || '').trim();
      const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

      if (process.env.SMTP_SERVICE) {
        return nodemailer.createTransport({
          service: process.env.SMTP_SERVICE,
          auth: {
            user,
            pass,
          },
        });
      }
      const port = parseInt(process.env.SMTP_PORT || '587', 10);
      const secure = process.env.SMTP_SECURE === 'true' || port === 465;
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: {
          user,
          pass,
        },
      });
    } catch (err) {
      console.error('[EMAIL SERVICE] Error initializing nodemailer transporter:', err.message);
      return null;
    }
  }
  return null;
}

async function sendMail(to, subject, html) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EMAIL SERVICE] No SMTP credentials configured. Email to ${to} skipped (logged above).`);
    return false;
  }
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@campusexchange.edu',
      to,
      subject,
      html,
    });
    console.log(`[EMAIL SERVICE] Email successfully dispatched to ${to} (MessageId: ${info.messageId})`);
    return true;
  } catch (err) {
    console.error('[EMAIL SERVICE] SMTP dispatch error:', err.message);
    return false;
  }
}

async function sendVerificationEmail(user) {
  const client = await pool.connect();
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  try {
    // Delete existing tokens for this user
    await client.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [user.id]);

    await client.query(
      'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );
  } finally {
    client.release();
  }

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();
  const link = `${frontendUrl}/verify-email?token=${rawToken}`;

  console.log(`
================================================================================
[EMAIL SERVICE] University Verification Link for: ${user.email}
Student Name : ${user.full_name || user.fullName || 'Student'}
Direct Link  : ${link}
Expires in   : 24 Hours
================================================================================
`);

  const appName = process.env.APP_NAME || 'Campus Exchange';
  const sent = await sendMail(
    user.email,
    `[${appName}] Verify Your University Email`,
    `<h2>Welcome to ${appName}, ${user.full_name || user.fullName || 'Student'}!</h2>
     <p>Please click below to verify your student email address and activate your marketplace privileges:</p>
     <p><a href="${link}" style="background:#059669;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;">Verify Email</a></p>
     <p>Or paste this link into your browser: <br/><a href="${link}">${link}</a></p>
     <p>This activation link expires in 24 hours.</p>`
  );

  return { token: rawToken, link, sent };
}

async function sendPasswordResetEmail(user) {
  const client = await pool.connect();
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

  try {
    await client.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);

    await client.query(
      'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    );
  } finally {
    client.release();
  }

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();
  const link = `${frontendUrl}/reset-password?token=${rawToken}`;

  console.log(`
================================================================================
[EMAIL SERVICE] Password Reset Link for: ${user.email}
Direct Link  : ${link}
Expires in   : 2 Hours
================================================================================
`);

  const appName = process.env.APP_NAME || 'Campus Exchange';
  const sent = await sendMail(
    user.email,
    `[${appName}] Password Reset Request`,
    `<h2>Password Reset Request</h2>
     <p>Hello ${user.full_name || user.fullName || 'Student'},</p>
     <p>Click below to securely reset your password:</p>
     <p><a href="${link}" style="background:#059669;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;">Reset Password</a></p>
     <p>Or copy this link: <br/><a href="${link}">${link}</a></p>
     <p>This link is valid for 2 hours. If you did not request this, please disregard.</p>`
  );

  return { token: rawToken, link, sent };
}

module.exports = {
  generateRawToken,
  hashToken,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
