// repositories/categoryRepository.js — All DB queries for categories
const pool = require('../db/pool');

async function findAll(activeOnly = true) {
  const query = activeOnly
    ? 'SELECT * FROM categories WHERE active = TRUE ORDER BY display_order ASC, name ASC'
    : 'SELECT * FROM categories ORDER BY display_order ASC, name ASC';
  const r = await pool.query(query);
  return r.rows;
}

async function findById(id) {
  const r = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);
  return r.rows[0] || null;
}

async function findByName(name) {
  const r = await pool.query('SELECT * FROM categories WHERE name = $1', [name]);
  return r.rows[0] || null;
}

async function create({ name, slug, description, imageUrl, displayOrder }) {
  const r = await pool.query(
    `INSERT INTO categories (name, slug, description, image_url, display_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, slug || name.toLowerCase().replace(/\s+/g, '-'), description || null, imageUrl || null, displayOrder || 0]
  );
  return r.rows[0];
}

async function update(id, { name, slug, description, imageUrl, displayOrder }) {
  const r = await pool.query(
    `UPDATE categories
     SET name = $1, slug = $2, description = $3, image_url = $4, display_order = $5
     WHERE id = $6
     RETURNING *`,
    [name, slug || null, description || null, imageUrl || null, displayOrder ?? 0, id]
  );
  return r.rows[0] || null;
}

async function setActive(id, active) {
  const r = await pool.query(
    'UPDATE categories SET active = $1 WHERE id = $2 RETURNING *',
    [active, id]
  );
  return r.rows[0] || null;
}

module.exports = { findAll, findById, findByName, create, update, setActive };
