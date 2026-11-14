// src/routes/listings.js — Marketplace listings & photo gallery
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { NotFoundError, BadRequestError, UnauthorizedError, ConflictError } = require('../middleware/errors');

const router = express.Router();

// ── Multer setup for local image storage ──────────────────────────────────────
const uploadsDir = path.resolve(process.env.UPLOADS_DIR || 'uploads', 'listings');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10) * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new BadRequestError('Invalid image format. Allowed formats: JPG, JPEG, PNG, WEBP'));
    }
  },
});

// ── Helper: Map raw listing row to ListingResponseDto ─────────────────────────
async function toListingDto(listing) {
  const imagesResult = await pool.query(
    'SELECT image_url, is_primary FROM listing_images WHERE listing_id = $1 ORDER BY display_order ASC',
    [listing.id]
  );

  const images = imagesResult.rows.map(r => r.image_url);
  const primaryRow = imagesResult.rows.find(r => r.is_primary);
  const primaryImageUrl = primaryRow
    ? primaryRow.image_url
    : (images.length > 0 ? images[0] : (listing.image_url || null));

  return {
    id: Number(listing.id),
    sellerId: Number(listing.seller_id),
    sellerName: listing.seller_name || 'Unknown Student',
    categoryId: Number(listing.category_id),
    categoryName: listing.category_name || '',
    title: listing.title,
    description: listing.description,
    itemCondition: listing.item_condition,
    transactionType: listing.transaction_type,
    qtyTotal: listing.qty_total,
    qtyAvailable: listing.qty_available,
    qtyReserved: listing.qty_reserved,
    price: parseFloat(listing.price),
    priceBasis: listing.price_basis,
    imageUrl: primaryImageUrl,
    images: images.length > 0 ? images : (listing.image_url ? [listing.image_url] : []),
    status: listing.status,
    createdAt: listing.created_at,
  };
}

async function fetchListingById(id) {
  const result = await pool.query(
    `SELECT l.*, u.full_name AS seller_name, c.name AS category_name
     FROM listings l
     LEFT JOIN users u ON u.id = l.seller_id
     LEFT JOIN categories c ON c.id = l.category_id
     WHERE l.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

// ── GET /api/v1/listings — Browse with search, filters & pagination ───────────
router.get('/', async (req, res, next) => {
  try {
    const {
      q = '',
      type = '',
      category = '0',
      condition = '',
      minPrice,
      maxPrice,
      sort = 'newest',
      page = '0',
      size = '12',
    } = req.query;

    const pageNum = Math.max(0, parseInt(page, 10) || 0);
    const pageSize = Math.min(Math.max(1, parseInt(size, 10) || 12), 50);
    const offset = pageNum * pageSize;
    const categoryId = parseInt(category, 10) || 0;

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

    if (categoryId > 0) {
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderClause = 'ORDER BY l.created_at DESC';
    if (sort === 'price_asc') {
      orderClause = 'ORDER BY l.price ASC, l.created_at DESC';
    } else if (sort === 'price_desc') {
      orderClause = 'ORDER BY l.price DESC, l.created_at DESC';
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM listings l ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);
    const totalPages = Math.ceil(total / pageSize);

    params.push(pageSize, offset);
    const query = `
      SELECT l.*, u.full_name AS seller_name, c.name AS category_name
      FROM listings l
      LEFT JOIN users u ON u.id = l.seller_id
      LEFT JOIN categories c ON c.id = l.category_id
      ${whereClause}
      ${orderClause}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const listingsResult = await pool.query(query, params);
    const items = await Promise.all(listingsResult.rows.map(toListingDto));

    res.json({
      success: true,
      data: {
        items,
        page: pageNum,
        size: pageSize,
        total,
        totalPages,
        last: pageNum >= totalPages - 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/listings/mine — Current user's listings ────────────────────────
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT l.*, u.full_name AS seller_name, c.name AS category_name
       FROM listings l
       LEFT JOIN users u ON u.id = l.seller_id
       LEFT JOIN categories c ON c.id = l.category_id
       WHERE l.seller_id = $1 AND l.status != 'REMOVED'
       ORDER BY l.created_at DESC`,
      [req.userId]
    );

    const items = await Promise.all(result.rows.map(toListingDto));
    res.json({
      success: true,
      data: items,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/listings/:id — Single listing details ─────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const listing = await fetchListingById(req.params.id);
    if (!listing || listing.status === 'REMOVED') {
      throw new NotFoundError('Listing not found');
    }

    const dto = await toListingDto(listing);
    res.json({
      success: true,
      data: dto,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/listings — Create new listing ────────────────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const seller = userRes.rows[0];
    if (!seller) throw new NotFoundError('User profile not found');

    if (!seller.verified) {
      throw new UnauthorizedError('Please verify your university email before creating product listings.');
    }

    const {
      title,
      description,
      categoryId,
      itemCondition,
      transactionType,
      quantity,
      price,
      priceBasis,
      imageUrl,
      imageUrls,
    } = req.body;

    if (!title || !description || !categoryId || !itemCondition || !transactionType || quantity === undefined) {
      throw new BadRequestError('Required listing fields missing');
    }

    const type = String(transactionType).trim().toUpperCase();
    if (!['SELL', 'RENT', 'LEND'].includes(type)) {
      throw new BadRequestError('Transaction type must be SELL, RENT, or LEND');
    }

    const condition = String(itemCondition).trim().toUpperCase();
    if (!['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'].includes(condition)) {
      throw new BadRequestError('Condition must be NEW, LIKE_NEW, GOOD, or FAIR');
    }

    const catCheck = await pool.query('SELECT id FROM categories WHERE id = $1', [parseInt(categoryId, 10)]);
    if (catCheck.rows.length === 0) {
      throw new BadRequestError('Selected category does not exist');
    }

    let parsedPrice = type === 'LEND' ? 0.0 : parseFloat(price || 0);
    if (type !== 'LEND' && parsedPrice <= 0) {
      throw new BadRequestError('Price must be greater than zero');
    }

    let parsedBasis = 'NONE';
    if (type === 'RENT') {
      parsedBasis = String(priceBasis || '').trim().toUpperCase();
      if (!['PER_DAY', 'PER_WEEK', 'PER_MONTH'].includes(parsedBasis)) {
        throw new BadRequestError('Please select a rental pricing basis (PER_DAY, PER_WEEK, PER_MONTH)');
      }
    }

    const qty = parseInt(quantity, 10);
    if (qty <= 0) {
      throw new BadRequestError('Quantity must be greater than zero');
    }

    const insertResult = await pool.query(
      `INSERT INTO listings (
         seller_id, category_id, title, description, item_condition, transaction_type,
         qty_total, qty_available, qty_reserved, price, price_basis, image_url
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, 0, $8, $9, $10)
       RETURNING *`,
      [
        req.userId,
        parseInt(categoryId, 10),
        title.trim(),
        description.trim(),
        condition,
        type,
        qty,
        parsedPrice,
        parsedBasis,
        imageUrl ? imageUrl.trim() : null,
      ]
    );

    const saved = insertResult.rows[0];

    // If multi-images array provided as URLs
    if (imageUrls && Array.isArray(imageUrls)) {
      let order = 0;
      for (const url of imageUrls) {
        if (url && typeof url === 'string' && url.trim()) {
          await pool.query(
            `INSERT INTO listing_images (listing_id, image_url, storage_key, is_primary, display_order)
             VALUES ($1, $2, $3, $4, $5)`,
            [saved.id, url.trim(), url.trim(), order === 0, order]
          );
          order++;
        }
      }
    }

    const fullListing = await fetchListingById(saved.id);
    const dto = await toListingDto(fullListing);

    res.status(201).json({
      success: true,
      message: 'Listing created successfully',
      data: dto,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/listings/:id/images — Upload photo ───────────────────────────
router.post('/:id/images', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    const listing = await fetchListingById(req.params.id);
    if (!listing) throw new NotFoundError('Listing not found');

    if (Number(listing.seller_id) !== req.userId) {
      throw new UnauthorizedError('You can only upload images for your own listings');
    }

    const countRes = await pool.query(
      'SELECT COUNT(*) FROM listing_images WHERE listing_id = $1',
      [listing.id]
    );
    const count = parseInt(countRes.rows[0].count, 10);
    const maxPhotos = parseInt(process.env.MAX_IMAGES_PER_LISTING || '5', 10);

    if (count >= maxPhotos) {
      if (req.file) fs.unlinkSync(req.file.path);
      throw new BadRequestError(`Maximum ${maxPhotos} photos allowed per listing`);
    }

    if (!req.file) {
      throw new BadRequestError('No image file uploaded');
    }

    const storageKey = `listings/${req.file.filename}`;
    const imageUrl = `/uploads/${storageKey}`;
    const isPrimary = count === 0;

    await pool.query(
      `INSERT INTO listing_images (listing_id, image_url, storage_key, is_primary, display_order)
       VALUES ($1, $2, $3, $4, $5)`,
      [listing.id, imageUrl, storageKey, isPrimary, count]
    );

    if (isPrimary || !listing.image_url) {
      await pool.query('UPDATE listings SET image_url = $1, updated_at = NOW() WHERE id = $2', [
        imageUrl,
        listing.id,
      ]);
    }

    const fullListing = await fetchListingById(listing.id);
    const dto = await toListingDto(fullListing);

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: dto,
    });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/v1/listings/:id/images/:imageId ───────────────────────────────
router.delete('/:id/images/:imageId', authenticate, async (req, res, next) => {
  try {
    const listing = await fetchListingById(req.params.id);
    if (!listing) throw new NotFoundError('Listing not found');

    if (Number(listing.seller_id) !== req.userId) {
      throw new UnauthorizedError('You can only modify images for your own listings');
    }

    const imageResult = await pool.query(
      'SELECT * FROM listing_images WHERE id = $1 AND listing_id = $2',
      [req.params.imageId, req.params.id]
    );
    const image = imageResult.rows[0];

    if (!image) {
      throw new NotFoundError('Image not found on this listing');
    }

    // Try deleting physical file
    try {
      const filePath = path.resolve(process.env.UPLOADS_DIR || 'uploads', image.storage_key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (_) {}

    await pool.query('DELETE FROM listing_images WHERE id = $1', [image.id]);

    // Recalculate primary image if deleted was primary
    const remainingResult = await pool.query(
      'SELECT * FROM listing_images WHERE listing_id = $1 ORDER BY display_order ASC',
      [listing.id]
    );

    if (remainingResult.rows.length > 0) {
      if (image.is_primary) {
        const first = remainingResult.rows[0];
        await pool.query('UPDATE listing_images SET is_primary = TRUE WHERE id = $1', [first.id]);
        await pool.query('UPDATE listings SET image_url = $1, updated_at = NOW() WHERE id = $2', [
          first.image_url,
          listing.id,
        ]);
      }
    } else {
      await pool.query('UPDATE listings SET image_url = NULL, updated_at = NOW() WHERE id = $1', [
        listing.id,
      ]);
    }

    const fullListing = await fetchListingById(listing.id);
    const dto = await toListingDto(fullListing);

    res.json({
      success: true,
      message: 'Image removed successfully',
      data: dto,
    });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/v1/listings/:id/images/:imageId/primary ───────────────────────
router.patch('/:id/images/:imageId/primary', authenticate, async (req, res, next) => {
  try {
    const listing = await fetchListingById(req.params.id);
    if (!listing) throw new NotFoundError('Listing not found');

    if (Number(listing.seller_id) !== req.userId) {
      throw new UnauthorizedError('You can only modify images for your own listings');
    }

    const imagesResult = await pool.query(
      'SELECT * FROM listing_images WHERE listing_id = $1',
      [listing.id]
    );

    let targetImage = null;
    for (const img of imagesResult.rows) {
      const isTarget = Number(img.id) === parseInt(req.params.imageId, 10);
      await pool.query('UPDATE listing_images SET is_primary = $1 WHERE id = $2', [isTarget, img.id]);
      if (isTarget) targetImage = img;
    }

    if (!targetImage) {
      throw new NotFoundError('Image not found on this listing');
    }

    await pool.query('UPDATE listings SET image_url = $1, updated_at = NOW() WHERE id = $2', [
      targetImage.image_url,
      listing.id,
    ]);

    const fullListing = await fetchListingById(listing.id);
    const dto = await toListingDto(fullListing);

    res.json({
      success: true,
      message: 'Primary image updated',
      data: dto,
    });
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/v1/listings/:id ── Edit listing ─────────────────────────────────
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const listing = await fetchListingById(req.params.id);
    if (!listing) throw new NotFoundError('Listing not found');

    if (Number(listing.seller_id) !== req.userId) {
      throw new UnauthorizedError('You can only edit your own listings');
    }

    if (listing.status === 'REMOVED') {
      throw new ConflictError('Cannot edit a removed listing');
    }

    const {
      title,
      categoryId,
      description,
      itemCondition,
      transactionType,
      quantity,
      price,
      priceBasis,
    } = req.body;

    if (!title || !description || !itemCondition || !transactionType) {
      throw new BadRequestError('Title, description, condition, and transaction type are required');
    }

    const validConditions = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'];
    if (!validConditions.includes(itemCondition.toUpperCase())) {
      throw new BadRequestError('Invalid condition. Must be NEW, LIKE_NEW, GOOD, or FAIR');
    }

    const validTypes = ['SELL', 'RENT', 'LEND'];
    if (!validTypes.includes(transactionType.toUpperCase())) {
      throw new BadRequestError('Invalid transaction type. Must be SELL, RENT, or LEND');
    }

    const qtyTotal = parseInt(quantity !== undefined ? quantity : listing.qty_total, 10);
    if (isNaN(qtyTotal) || qtyTotal <= 0) {
      throw new BadRequestError('Total quantity must be at least 1');
    }

    // Business rule: Cannot set total quantity below currently reserved quantity
    if (qtyTotal < listing.qty_reserved) {
      throw new ConflictError(
        `Cannot reduce quantity to ${qtyTotal}. There are currently ${listing.qty_reserved} unit(s) reserved for pending/accepted requests.`
      );
    }

    let parsedPrice = 0.0;
    let basis = 'NONE';

    if (transactionType.toUpperCase() === 'SELL') {
      parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        throw new BadRequestError('Price for sale items must be greater than zero');
      }
    } else if (transactionType.toUpperCase() === 'RENT') {
      parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        throw new BadRequestError('Rental price must be greater than zero');
      }
      const validBases = ['PER_DAY', 'PER_WEEK', 'PER_MONTH'];
      if (!priceBasis || !validBases.includes(priceBasis.toUpperCase())) {
        throw new BadRequestError('Rental pricing basis must be PER_DAY, PER_WEEK, or PER_MONTH');
      }
      basis = priceBasis.toUpperCase();
    } else if (transactionType.toUpperCase() === 'LEND') {
      parsedPrice = 0.0;
      basis = 'NONE';
    }

    const newAvailable = qtyTotal - listing.qty_reserved;
    let newStatus = listing.status;
    if (newAvailable === 0 && listing.status === 'AVAILABLE') {
      newStatus = 'UNAVAILABLE';
    } else if (newAvailable > 0 && listing.status === 'UNAVAILABLE') {
      newStatus = 'AVAILABLE';
    }

    const catId = categoryId ? parseInt(categoryId, 10) : listing.category_id;

    await pool.query(
      `UPDATE listings
       SET title = $1, category_id = $2, description = $3, item_condition = $4,
           transaction_type = $5, qty_total = $6, qty_available = $7, price = $8,
           price_basis = $9, status = $10, updated_at = NOW()
       WHERE id = $11`,
      [
        title.trim(),
        catId,
        description.trim(),
        itemCondition.toUpperCase(),
        transactionType.toUpperCase(),
        qtyTotal,
        newAvailable,
        parsedPrice,
        basis,
        newStatus,
        listing.id,
      ]
    );

    const updated = await fetchListingById(listing.id);
    const dto = await toListingDto(updated);

    res.json({
      success: true,
      message: 'Listing updated successfully',
      data: dto,
    });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/v1/listings/:id/status ── Toggle availability ──────────────────
router.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    const listing = await fetchListingById(req.params.id);
    if (!listing) throw new NotFoundError('Listing not found');

    if (Number(listing.seller_id) !== req.userId) {
      throw new UnauthorizedError('You can only update status of your own listings');
    }

    const { status } = req.body;
    const allowedStatuses = ['AVAILABLE', 'UNAVAILABLE'];
    if (!status || !allowedStatuses.includes(status.toUpperCase())) {
      throw new BadRequestError('Status must be AVAILABLE or UNAVAILABLE');
    }

    const targetStatus = status.toUpperCase();
    if (targetStatus === 'AVAILABLE' && listing.qty_available <= 0) {
      throw new ConflictError('Cannot mark available when available quantity is zero');
    }

    await pool.query('UPDATE listings SET status = $1, updated_at = NOW() WHERE id = $2', [
      targetStatus,
      listing.id,
    ]);

    const updated = await fetchListingById(listing.id);
    const dto = await toListingDto(updated);

    res.json({
      success: true,
      message: `Listing is now ${targetStatus.toLowerCase()}`,
      data: dto,
    });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/v1/listings/:id — Soft-delete listing ─────────────────────────
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const listing = await fetchListingById(req.params.id);
    if (!listing) throw new NotFoundError('Listing not found');

    if (Number(listing.seller_id) !== req.userId) {
      throw new UnauthorizedError('You can only remove your own listings');
    }

    if (listing.qty_reserved > 0) {
      throw new ConflictError(
        'Cannot remove listing with active reserved requests. Please resolve or cancel them first.'
      );
    }

    await pool.query("UPDATE listings SET status = 'REMOVED', updated_at = NOW() WHERE id = $1", [
      listing.id,
    ]);

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
