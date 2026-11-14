// src/routes/categories.js — Category catalog
const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

// GET /api/v1/categories
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, name, slug, description, image_url, display_order
       FROM categories
       WHERE active = TRUE
       ORDER BY display_order ASC, name ASC`
    );

    const categories = result.rows.map(c => ({
      id: Number(c.id),
      name: c.name,
      slug: c.slug,
      description: c.description || null,
      imageUrl: c.image_url || null,
      displayOrder: c.display_order,
    }));

    res.json({
      success: true,
      data: categories,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
