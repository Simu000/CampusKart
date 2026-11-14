// src/routes/conversations.js — Private Conversations & Chat using MongoDB
const express = require('express');
const pool = require('../db/pool');
const { mongoose } = require('../db/mongo');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { authenticate } = require('../middleware/auth');
const { isEitherBlocked } = require('../repositories/blockRepository');
const {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ConflictError,
} = require('../middleware/errors');

const router = express.Router();

// GET /api/v1/conversations — List all active conversations for the logged-in student
router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = Number(req.userId);

    // If MongoDB is connected, fetch from MongoDB Conversation collection
    if (mongoose.connection.readyState === 1) {
      const convs = await Conversation.find({
        $or: [{ buyerId: userId }, { sellerId: userId }],
      })
        .sort({ updatedAt: -1 })
        .lean();

      return res.json({
        success: true,
        data: convs.map(c => ({
          id: c._id.toString(),
          requestId: c.requestId,
          listingId: c.listingId,
          listingTitle: c.listingTitle,
          buyerId: c.buyerId,
          buyerName: c.buyerName,
          sellerId: c.sellerId,
          sellerName: c.sellerName,
          lastMessage: c.lastMessage,
          lastMessageAt: c.lastMessageAt || c.updatedAt,
        })),
      });
    }

    // Fallback to PostgreSQL accepted requests
    const pgRes = await pool.query(
      `SELECT r.id AS request_id, r.listing_id, r.buyer_id, r.seller_id,
              l.title AS listing_title,
              b.full_name AS buyer_name,
              s.full_name AS seller_name,
              r.updated_at
       FROM item_requests r
       JOIN listings l ON l.id = r.listing_id
       JOIN users b ON b.id = r.buyer_id
       JOIN users s ON s.id = r.seller_id
       WHERE (r.buyer_id = $1 OR r.seller_id = $1)
         AND r.status IN ('ACCEPTED', 'COMPLETED')
       ORDER BY r.updated_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: pgRes.rows.map(r => ({
        id: String(r.request_id),
        requestId: Number(r.request_id),
        listingId: Number(r.listing_id),
        listingTitle: r.listing_title,
        buyerId: Number(r.buyer_id),
        buyerName: r.buyer_name,
        sellerId: Number(r.seller_id),
        sellerName: r.seller_name,
        lastMessage: '',
        lastMessageAt: r.updated_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/conversations/:requestId/messages
router.get('/:requestId/messages', authenticate, async (req, res, next) => {
  try {
    const requestId = Number(req.params.requestId);
    const reqResult = await pool.query('SELECT * FROM item_requests WHERE id = $1', [requestId]);
    const itemReq = reqResult.rows[0];
    if (!itemReq) throw new NotFoundError('Conversation not found');

    if (req.userId !== Number(itemReq.buyer_id) && req.userId !== Number(itemReq.seller_id)) {
      throw new NotFoundError('Conversation not found');
    }

    if (itemReq.status === 'PENDING' || itemReq.status === 'DECLINED') {
      return res.status(403).json({
        success: false,
        message: 'Chat becomes accessible only after the seller accepts the request',
      });
    }

    if (mongoose.connection.readyState === 1) {
      const msgs = await Message.find({ requestId }).sort({ createdAt: 1 }).lean();
      return res.json({
        success: true,
        data: msgs.map(m => ({
          id: m._id.toString(),
          requestId: m.requestId,
          senderId: m.senderId,
          senderName: m.senderName,
          body: m.body,
          createdAt: m.createdAt,
        })),
      });
    }

    const pgMsgs = await pool.query(
      `SELECT m.*, u.full_name AS sender_name
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.request_id = $1
       ORDER BY m.created_at ASC`,
      [requestId]
    );

    res.json({
      success: true,
      data: pgMsgs.rows.map(m => ({
        id: Number(m.id),
        requestId: Number(m.request_id),
        senderId: Number(m.sender_id),
        senderName: m.sender_name || 'Student',
        body: m.body,
        createdAt: m.created_at,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/conversations/:requestId/messages
router.post('/:requestId/messages', authenticate, async (req, res, next) => {
  try {
    const requestId = Number(req.params.requestId);
    const reqResult = await pool.query('SELECT * FROM item_requests WHERE id = $1', [requestId]);
    const itemReq = reqResult.rows[0];
    if (!itemReq) throw new NotFoundError('Conversation not found');

    if (req.userId !== Number(itemReq.buyer_id) && req.userId !== Number(itemReq.seller_id)) {
      throw new NotFoundError('Conversation not found');
    }

    if (itemReq.status === 'PENDING' || itemReq.status === 'DECLINED') {
      return res.status(403).json({
        success: false,
        message: 'Chat becomes accessible only after the seller accepts the request',
      });
    }

    if (itemReq.status !== 'ACCEPTED') {
      throw new ConflictError('Messaging is closed because this exchange is no longer active');
    }

    const blocked = await isEitherBlocked(itemReq.buyer_id, itemReq.seller_id);
    if (blocked) {
      throw new ConflictError('Messaging is restricted due to user blocking');
    }

    const { body } = req.body;
    if (!body || !String(body).trim()) {
      throw new BadRequestError('Message body cannot be empty');
    }

    const trimmedBody = String(body).trim();

    const senderRes = await pool.query('SELECT full_name FROM users WHERE id = $1', [req.userId]);
    const senderName = senderRes.rows[0]?.full_name || 'Student';

    if (mongoose.connection.readyState === 1) {
      const newMsg = await Message.create({
        requestId,
        senderId: req.userId,
        senderName,
        body: trimmedBody,
      });

      // Fetch listing title for the conversation summary
      const listingRes = await pool.query('SELECT title FROM listings WHERE id = $1', [
        itemReq.listing_id,
      ]);
      const listingTitle = listingRes.rows[0]?.title || '';

      // Update or insert conversation record in MongoDB
      await Conversation.findOneAndUpdate(
        { requestId },
        {
          $set: {
            listingId: Number(itemReq.listing_id),
            listingTitle,
            buyerId: Number(itemReq.buyer_id),
            sellerId: Number(itemReq.seller_id),
            lastMessage: trimmedBody.substring(0, 100),
            lastMessageAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      return res.status(201).json({
        success: true,
        message: 'Message sent',
        data: {
          id: newMsg._id.toString(),
          requestId: newMsg.requestId,
          senderId: newMsg.senderId,
          senderName: newMsg.senderName,
          body: newMsg.body,
          createdAt: newMsg.createdAt,
        },
      });
    }

    // Fallback to PostgreSQL
    const insertResult = await pool.query(
      `INSERT INTO messages (request_id, sender_id, body)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [requestId, req.userId, trimmedBody]
    );
    const msg = insertResult.rows[0];

    res.status(201).json({
      success: true,
      message: 'Message sent',
      data: {
        id: Number(msg.id),
        requestId: Number(msg.request_id),
        senderId: Number(msg.sender_id),
        senderName,
        body: msg.body,
        createdAt: msg.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
