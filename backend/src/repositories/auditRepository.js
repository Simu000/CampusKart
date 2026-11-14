// repositories/auditRepository.js — Audit log DB queries
const pool = require('../db/pool');

async function log({ actorId, action, targetType, targetId, reason, metadata }) {
  await pool.query(
    `INSERT INTO audit_logs (actor_id, action, target_type, target_id, reason)
     VALUES ($1, $2, $3, $4, $5)`,
    [actorId, action, targetType, String(targetId), reason || '']
  );
}

async function findRecent({ page = 0, size = 50 } = {}) {
  const r = await pool.query(
    `SELECT al.*, u.full_name AS actor_name
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.actor_id
     ORDER BY al.created_at DESC
     LIMIT $1 OFFSET $2`,
    [size, page * size]
  );
  return r.rows;
}

module.exports = { log, findRecent };
