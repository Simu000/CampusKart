// repositories/listingRepository.js — All DB queries for listings
const pool = require('../db/pool');

async function findById(id) {
  const r = await pool.query(
    `SELECT l.*, u.full_name AS seller_name, c.name AS category_name
     FROM listings l
     LEFT JOIN users u ON u.id = l.seller_id
     LEFT JOIN categories c ON c.id = l.category_id
     WHERE l.id = $1`,
    [id]
  );
  return r.rows[0] || null;
}

async function findImages(listingId) {
  const r = await pool.query(
    'SELECT * FROM listing_images WHERE listing_id = $1 ORDER BY display_order ASC',
    [listingId]
  );
  return r.rows;
}

async function search({ q, type, categoryId, condition, minPrice, maxPrice, sort, page, size }) {
  const pageNum = Math.max(0, parseInt(page, 10) || 0);
  const pageSize = Math.min(Math.max(1, parseInt(size, 10) || 12), 50);
  const offset = pageNum * pageSize;

  const conditions = ["l.status != 'REMOVED'"];
  const params = [];

  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    conditions.push(`(l.title ILIKE $${params.length} OR l.description ILIKE $${params.length})`);
  }
  if (type && type.trim()) {
    params.push(type.trim().toUpperCase());
    conditions.push(`l.transaction_type = $${params.length}`);
  }
  if (categoryId && categoryId > 0) {
    params.push(categoryId);
    conditions.push(`l.category_id = $${params.length}`);
  }
  if (condition && condition.trim()) {
    params.push(condition.trim().toUpperCase());
    conditions.push(`l.item_condition = $${params.length}`);
  }
  if (minPrice !== undefined && minPrice !== '') {
    params.push(parseFloat(minPrice));
    conditions.push(`l.price >= $${params.length}`);
  }
  if (maxPrice !== undefined && maxPrice !== '') {
    params.push(parseFloat(maxPrice));
    conditions.push(`l.price <= $${params.length}`);
  }

  const where = conditions.join(' AND ');
  const orderBy = sort === 'price_asc' ? 'l.price ASC' : sort === 'price_desc' ? 'l.price DESC' : 'l.created_at DESC';

  const countQuery = `SELECT COUNT(*) FROM listings l WHERE ${where}`;
  const dataQuery = `
    SELECT l.*, u.full_name AS seller_name, c.name AS category_name
    FROM listings l
    LEFT JOIN users u ON u.id = l.seller_id
    LEFT JOIN categories c ON c.id = l.category_id
    WHERE ${where}
    ORDER BY ${orderBy}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const [countResult, dataResult] = await Promise.all([
    pool.query(countQuery, params),
    pool.query(dataQuery, [...params, pageSize, offset]),
  ]);

  return {
    rows: dataResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
    page: pageNum,
    size: pageSize,
  };
}

async function findBySeller(sellerId) {
  const r = await pool.query(
    `SELECT l.*, u.full_name AS seller_name, c.name AS category_name
     FROM listings l
     LEFT JOIN users u ON u.id = l.seller_id
     LEFT JOIN categories c ON c.id = l.category_id
     WHERE l.seller_id = $1
     ORDER BY l.created_at DESC`,
    [sellerId]
  );
  return r.rows;
}

async function create({ sellerId, categoryId, title, description, itemCondition, transactionType, qtyTotal, price, priceBasis, imageUrl }) {
  const r = await pool.query(
    `INSERT INTO listings
       (seller_id, category_id, title, description, item_condition, transaction_type, qty_total, qty_available, qty_reserved, price, price_basis, image_url, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7, 0, $8, $9, $10, 'AVAILABLE')
     RETURNING *`,
    [sellerId, categoryId, title, description, itemCondition, transactionType, qtyTotal, price, priceBasis, imageUrl || null]
  );
  return r.rows[0];
}

async function update(id, { categoryId, title, description, itemCondition, transactionType, qtyTotal, price, priceBasis }) {
  const r = await pool.query(
    `UPDATE listings
     SET category_id = $1, title = $2, description = $3, item_condition = $4,
         transaction_type = $5, qty_total = $6, price = $7, price_basis = $8, updated_at = NOW()
     WHERE id = $9
     RETURNING *`,
    [categoryId, title, description, itemCondition, transactionType, qtyTotal, price, priceBasis, id]
  );
  return r.rows[0] || null;
}

async function updateStatus(id, status) {
  const r = await pool.query(
    "UPDATE listings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
    [status, id]
  );
  return r.rows[0] || null;
}

async function softDelete(id) {
  await pool.query(
    "UPDATE listings SET status = 'REMOVED', updated_at = NOW() WHERE id = $1",
    [id]
  );
}

async function addImage({ listingId, imageUrl, storageKey, isPrimary, displayOrder }) {
  const r = await pool.query(
    `INSERT INTO listing_images (listing_id, image_url, storage_key, is_primary, display_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [listingId, imageUrl, storageKey, isPrimary || false, displayOrder || 0]
  );
  return r.rows[0];
}

async function countImages(listingId) {
  const r = await pool.query('SELECT COUNT(*) FROM listing_images WHERE listing_id = $1', [listingId]);
  return parseInt(r.rows[0].count, 10);
}

async function findImageById(imageId, listingId) {
  const r = await pool.query(
    'SELECT * FROM listing_images WHERE id = $1 AND listing_id = $2',
    [imageId, listingId]
  );
  return r.rows[0] || null;
}

async function deleteImage(imageId) {
  await pool.query('DELETE FROM listing_images WHERE id = $1', [imageId]);
}

async function setPrimaryImage(listingId, imageId) {
  await pool.query('UPDATE listing_images SET is_primary = FALSE WHERE listing_id = $1', [listingId]);
  await pool.query('UPDATE listing_images SET is_primary = TRUE WHERE id = $1', [imageId]);
}

async function updatePrimaryImageUrl(listingId, imageUrl) {
  await pool.query('UPDATE listings SET image_url = $1, updated_at = NOW() WHERE id = $2', [imageUrl, listingId]);
}

async function countPendingRequests(listingId) {
  const r = await pool.query(
    "SELECT COUNT(*) FROM item_requests WHERE listing_id = $1 AND status = 'PENDING'",
    [listingId]
  );
  return parseInt(r.rows[0].count, 10);
}

async function findAllAdmin({ search = '', page = 0, size = 20 } = {}) {
  const offset = page * size;
  const params = [];
  let where = '';
  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    where = `WHERE l.title ILIKE $${params.length}`;
  }
  params.push(size, offset);
  const r = await pool.query(
    `SELECT l.*, u.full_name AS seller_name, c.name AS category_name
     FROM listings l
     LEFT JOIN users u ON u.id = l.seller_id
     LEFT JOIN categories c ON c.id = l.category_id
     ${where}
     ORDER BY l.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return r.rows;
}

module.exports = {
  findById, findImages, search, findBySeller, create, update, updateStatus, softDelete,
  addImage, countImages, findImageById, deleteImage, setPrimaryImage, updatePrimaryImageUrl,
  countPendingRequests, findAllAdmin,
};
