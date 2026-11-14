// repositories/reportRepository.js — All DB queries for reports
const pool = require('../db/pool');

async function create({ reporterId, reportedUserId, listingId, reason, description }) {
  const r = await pool.query(
    `INSERT INTO reports (reporter_id, reported_user_id, listing_id, reason, description)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [reporterId, reportedUserId || null, listingId || null, reason, description || null]
  );
  return r.rows[0];
}

async function findAll({ status = '', page = 0, size = 20 } = {}) {
  const offset = page * size;
  const params = [];
  let where = '';
  if (status && status.trim()) {
    params.push(status.trim().toUpperCase());
    where = `WHERE r.status = $${params.length}`;
  }
  params.push(size, offset);

  const r = await pool.query(
    `SELECT r.*,
            reporter.full_name AS reporter_name,
            reported.full_name AS reported_user_name,
            l.title AS listing_title,
            reviewer.full_name AS reviewed_by_name
     FROM reports r
     LEFT JOIN users reporter ON reporter.id = r.reporter_id
     LEFT JOIN users reported ON reported.id = r.reported_user_id
     LEFT JOIN listings l ON l.id = r.listing_id
     LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
     ${where}
     ORDER BY r.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return r.rows;
}

async function countAll(status = '') {
  if (status) {
    const r = await pool.query('SELECT COUNT(*) FROM reports WHERE status = $1', [status.toUpperCase()]);
    return parseInt(r.rows[0].count, 10);
  }
  const r = await pool.query('SELECT COUNT(*) FROM reports');
  return parseInt(r.rows[0].count, 10);
}

async function findById(id) {
  const r = await pool.query(
    `SELECT r.*,
            reporter.full_name AS reporter_name,
            reported.full_name AS reported_user_name,
            l.title AS listing_title,
            reviewer.full_name AS reviewed_by_name
     FROM reports r
     LEFT JOIN users reporter ON reporter.id = r.reporter_id
     LEFT JOIN users reported ON reported.id = r.reported_user_id
     LEFT JOIN listings l ON l.id = r.listing_id
     LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
     WHERE r.id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

async function update(id, { status, adminNotes, reviewedBy }) {
  const r = await pool.query(
    `UPDATE reports
     SET status = $1, admin_notes = $2, reviewed_by = $3, reviewed_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [status, adminNotes || null, reviewedBy, id]
  );
  return r.rows[0] || null;
}

async function countByReportedUser(userId) {
  const r = await pool.query(
    "SELECT COUNT(*) FROM reports WHERE reported_user_id = $1 AND status = 'PENDING'",
    [userId]
  );
  return parseInt(r.rows[0].count, 10);
}

module.exports = { create, findAll, countAll, findById, update, countByReportedUser };
