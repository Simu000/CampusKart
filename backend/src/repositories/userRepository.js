// repositories/userRepository.js — All DB queries for users
const pool = require('../db/pool');

async function findById(id) {
  const r = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return r.rows[0] || null;
}

async function findByEmail(email) {
  const r = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return r.rows[0] || null;
}

async function create({ fullName, email, passwordHash, department, course, studyYear }) {
  const r = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, department, course, study_year, verified)
     VALUES ($1, $2, $3, $4, $5, $6, FALSE)
     RETURNING *`,
    [fullName, email, passwordHash, department || null, course || null, studyYear || null]
  );
  return r.rows[0];
}

async function updateProfile(id, { fullName, department, course, studyYear, profileImageUrl }) {
  const r = await pool.query(
    `UPDATE users
     SET full_name = COALESCE($1, full_name),
         department = COALESCE($2, department),
         course = COALESCE($3, course),
         study_year = COALESCE($4, study_year),
         profile_image_url = COALESCE($5, profile_image_url),
         updated_at = NOW()
     WHERE id = $6
     RETURNING *`,
    [fullName || null, department || null, course || null, studyYear || null, profileImageUrl || null, id]
  );
  return r.rows[0] || null;
}

async function updateStatus(id, status) {
  const r = await pool.query(
    'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [status, id]
  );
  return r.rows[0] || null;
}

async function findAll({ search = '', page = 0, size = 20 } = {}) {
  const offset = page * size;
  let query = 'SELECT * FROM users';
  const params = [];
  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    query += ` WHERE full_name ILIKE $${params.length} OR email ILIKE $${params.length}`;
  }
  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(size, offset);
  const r = await pool.query(query, params);
  return r.rows;
}

async function countAll(search = '') {
  if (search && search.trim()) {
    const r = await pool.query(
      `SELECT COUNT(*) FROM users WHERE full_name ILIKE $1 OR email ILIKE $1`,
      [`%${search.trim()}%`]
    );
    return parseInt(r.rows[0].count, 10);
  }
  const r = await pool.query('SELECT COUNT(*) FROM users');
  return parseInt(r.rows[0].count, 10);
}

async function markVerified(id) {
  await pool.query(
    'UPDATE users SET verified = TRUE, updated_at = NOW() WHERE id = $1',
    [id]
  );
}

async function updatePasswordHash(id, passwordHash) {
  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
    [passwordHash, id]
  );
}

module.exports = {
  findById,
  findByEmail,
  create,
  updateProfile,
  updateStatus,
  findAll,
  countAll,
  markVerified,
  updatePasswordHash,
};
