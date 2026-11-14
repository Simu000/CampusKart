// src/routes/requests.js — Exchange requests, mutual confirmation & private messaging
const express = require('express');
const pool = require('../db/pool');
const { mongoose } = require('../db/mongo');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { authenticate } = require('../middleware/auth');
const { sendNotification } = require('../services/notification');
const { isEitherBlocked } = require('../repositories/blockRepository');
const {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ConflictError,
} = require('../middleware/errors');

const router = express.Router();

// ── Helper: Map request to ItemRequestResponseDto ─────────────────────────────
async function toItemRequestDto(req, currentUserId) {
  const listingResult = await pool.query('SELECT * FROM listings WHERE id = $1', [req.listing_id]);
  const listing = listingResult.rows[0];

  const buyerResult = await pool.query('SELECT full_name FROM users WHERE id = $1', [req.buyer_id]);
  const buyerName = buyerResult.rows[0]?.full_name || 'Unknown Student';

  const sellerResult = await pool.query('SELECT full_name FROM users WHERE id = $1', [req.seller_id]);
  const sellerName = sellerResult.rows[0]?.full_name || 'Unknown Student';

  const confResult = await pool.query(
    'SELECT * FROM exchange_confirmations WHERE request_id = $1',
    [req.id]
  );
  const confirmations = confResult.rows;

  const confirmedByBuyer = confirmations.some(c => Number(c.confirmed_by) === Number(req.buyer_id));
  const confirmedBySeller = confirmations.some(c => Number(c.confirmed_by) === Number(req.seller_id));
  const hasCurrentUserConfirmed = confirmations.some(
    c => Number(c.confirmed_by) === Number(currentUserId)
  );

  const isParticipant =
    currentUserId &&
    (Number(currentUserId) === Number(req.buyer_id) || Number(currentUserId) === Number(req.seller_id));

  const canConfirm = req.status === 'ACCEPTED' && isParticipant && !hasCurrentUserConfirmed;

  const isBuyer = currentUserId && Number(currentUserId) === Number(req.buyer_id);
  const peerConfirmed = isBuyer ? confirmedBySeller : confirmedByBuyer;
  const awaitingPeerConfirmation = req.status === 'ACCEPTED' && hasCurrentUserConfirmed && !peerConfirmed;
  const peerHasConfirmed = peerConfirmed && !hasCurrentUserConfirmed;

  return {
    id: Number(req.id),
    listingId: Number(req.listing_id),
    listingTitle: listing ? listing.title : 'Unavailable Item',
    transactionType: listing ? listing.transaction_type : 'SELL',
    listingImageUrl: listing ? listing.image_url : null,
    quantity: req.quantity,
    note: req.note || null,
    status: req.status,
    buyerId: Number(req.buyer_id),
    buyerName,
    sellerId: Number(req.seller_id),
    sellerName,
    isConfirmedByBuyer: confirmedByBuyer,
    isConfirmedBySeller: confirmedBySeller,
    hasCurrentUserConfirmed,
    canConfirm,
    awaitingPeerConfirmation,
    peerHasConfirmed,
    expiresAt: req.expires_at,
    createdAt: req.created_at,
  };
}

// ── POST /api/v1/requests — Submit request to seller ──────────────────────────
router.post('/', authenticate, async (req, res, next) => {
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    const buyer = userRes.rows[0];
    if (!buyer) throw new NotFoundError('User profile not found');

    if (!buyer.verified) {
      throw new UnauthorizedError('Please verify your university email before submitting item requests.');
    }

    const { listingId, quantity, note } = req.body;
    if (!listingId || quantity === undefined) {
      throw new BadRequestError('Listing ID and quantity are required');
    }

    const listingRes = await pool.query('SELECT * FROM listings WHERE id = $1', [parseInt(listingId, 10)]);
    const listing = listingRes.rows[0];
    if (!listing) throw new NotFoundError('Listing not found');

    if (Number(listing.seller_id) === req.userId) {
      throw new BadRequestError('You cannot request your own listing');
    }

    const blocked = await isEitherBlocked(req.userId, listing.seller_id);
    if (blocked) {
      throw new ConflictError('Cannot request item due to user blocking restrictions');
    }

    if (listing.status !== 'AVAILABLE') {
      throw new ConflictError('This listing is currently unavailable');
    }

    const qty = parseInt(quantity, 10);
    if (qty <= 0) {
      throw new BadRequestError('Quantity must be greater than zero');
    }

    if (qty > listing.qty_available) {
      throw new ConflictError(`Only ${listing.qty_available} unit(s) available`);
    }

    const existingPending = await pool.query(
      "SELECT id FROM item_requests WHERE listing_id = $1 AND buyer_id = $2 AND status = 'PENDING'",
      [listing.id, req.userId]
    );
    if (existingPending.rows.length > 0) {
      throw new ConflictError('You already have an active pending request for this item');
    }

    // 72-hour expiration window
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const insertResult = await pool.query(
      `INSERT INTO item_requests (listing_id, buyer_id, seller_id, quantity, note, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [listing.id, req.userId, listing.seller_id, qty, note ? String(note).trim() : null, expiresAt]
    );

    const saved = insertResult.rows[0];

    // Notification to seller
    sendNotification(
      listing.seller_id,
      'REQUEST_RECEIVED',
      'New Exchange Request',
      `${buyer.full_name} has requested "${listing.title}" (Qty: ${qty})`,
      'REQUEST',
      saved.id
    );

    const dto = await toItemRequestDto(saved, req.userId);
    res.status(201).json({
      success: true,
      message: 'Request sent to seller',
      data: dto,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/requests/sent — Sent requests ─────────────────────────────────
router.get('/sent', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM item_requests WHERE buyer_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    const dtos = await Promise.all(result.rows.map(r => toItemRequestDto(r, req.userId)));
    res.json({
      success: true,
      data: dtos,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/requests/received — Received requests ─────────────────────────
router.get('/received', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM item_requests WHERE seller_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    const dtos = await Promise.all(result.rows.map(r => toItemRequestDto(r, req.userId)));
    res.json({
      success: true,
      data: dtos,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/requests/:id — Single request ─────────────────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM item_requests WHERE id = $1', [req.params.id]);
    const itemReq = result.rows[0];
    if (!itemReq) throw new NotFoundError('Request not found');

    if (req.userId !== Number(itemReq.buyer_id) && req.userId !== Number(itemReq.seller_id)) {
      throw new NotFoundError('Request not found'); // Guard against IDOR
    }

    const dto = await toItemRequestDto(itemReq, req.userId);
    res.json({
      success: true,
      data: dto,
    });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/v1/requests/:id/accept ─────────────────────────────────────────
router.patch('/:id/accept', authenticate, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reqResult = await client.query('SELECT * FROM item_requests WHERE id = $1 FOR UPDATE', [
      req.params.id,
    ]);
    const itemReq = reqResult.rows[0];
    if (!itemReq) throw new NotFoundError('Request not found');

    if (req.userId !== Number(itemReq.seller_id)) {
      throw new UnauthorizedError('Only the seller can accept this request');
    }

    if (itemReq.status !== 'PENDING') {
      throw new ConflictError('Request is no longer pending');
    }

    // Pessimistic lock on listing to reserve stock
    const listingResult = await client.query('SELECT * FROM listings WHERE id = $1 FOR UPDATE', [
      itemReq.listing_id,
    ]);
    const listing = listingResult.rows[0];

    if (!listing || listing.status !== 'AVAILABLE' || listing.qty_available < itemReq.quantity) {
      throw new ConflictError('Insufficient stock available to fulfill this request');
    }

    const newAvailable = listing.qty_available - itemReq.quantity;
    const newReserved = listing.qty_reserved + itemReq.quantity;
    const newStatus = newAvailable === 0 ? 'UNAVAILABLE' : 'AVAILABLE';

    await client.query(
      `UPDATE listings
       SET qty_available = $1, qty_reserved = $2, status = $3, updated_at = NOW()
       WHERE id = $4`,
      [newAvailable, newReserved, newStatus, listing.id]
    );

    const updateReq = await client.query(
      `UPDATE item_requests
       SET status = 'ACCEPTED', accepted_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [itemReq.id]
    );

    // Ensure conversation record exists in PostgreSQL
    await client.query(
      `INSERT INTO conversations (request_id, buyer_id, seller_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (request_id) DO NOTHING`,
      [itemReq.id, itemReq.buyer_id, itemReq.seller_id]
    );

    // Sync active conversation to MongoDB
    if (mongoose.connection.readyState === 1) {
      try {
        const buyerRes = await client.query('SELECT full_name FROM users WHERE id = $1', [itemReq.buyer_id]);
        const sellerRes = await client.query('SELECT full_name FROM users WHERE id = $1', [itemReq.seller_id]);
        await Conversation.findOneAndUpdate(
          { requestId: Number(itemReq.id) },
          {
            $set: {
              listingId: Number(itemReq.listing_id),
              listingTitle: listing.title,
              buyerId: Number(itemReq.buyer_id),
              buyerName: buyerRes.rows[0]?.full_name || 'Student',
              sellerId: Number(itemReq.seller_id),
              sellerName: sellerRes.rows[0]?.full_name || 'Student',
              lastMessage: 'Conversation opened',
              lastMessageAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
            },
          },
          { upsert: true }
        );
      } catch (mErr) {
        console.warn('MongoDB conversation sync note:', mErr.message);
      }
    }

    await client.query('COMMIT');

    // Notify buyer
    sendNotification(
      itemReq.buyer_id,
      'REQUEST_ACCEPTED',
      'Request Accepted',
      `Your request for "${listing.title}" has been accepted. You can now chat to coordinate pickup!`,
      'REQUEST',
      itemReq.id
    );

    const dto = await toItemRequestDto(updateReq.rows[0], req.userId);
    res.json({
      success: true,
      message: 'Request accepted. Conversation is now active.',
      data: dto,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ── PATCH /api/v1/requests/:id/decline ────────────────────────────────────────
router.patch('/:id/decline', authenticate, async (req, res, next) => {
  try {
    const reqResult = await pool.query('SELECT * FROM item_requests WHERE id = $1', [req.params.id]);
    const itemReq = reqResult.rows[0];
    if (!itemReq) throw new NotFoundError('Request not found');

    if (req.userId !== Number(itemReq.seller_id)) {
      throw new UnauthorizedError('Only the seller can decline this request');
    }

    if (itemReq.status !== 'PENDING') {
      throw new ConflictError('Request is no longer pending');
    }

    const updateRes = await pool.query(
      `UPDATE item_requests
       SET status = 'DECLINED', declined_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [itemReq.id]
    );

    sendNotification(
      itemReq.buyer_id,
      'REQUEST_DECLINED',
      'Request Declined',
      'Your request could not be fulfilled by the seller at this time.',
      'REQUEST',
      itemReq.id
    );

    const dto = await toItemRequestDto(updateRes.rows[0], req.userId);
    res.json({
      success: true,
      message: 'Request declined',
      data: dto,
    });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/v1/requests/:id/cancel ─────────────────────────────────────────
router.patch('/:id/cancel', authenticate, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reqResult = await client.query('SELECT * FROM item_requests WHERE id = $1 FOR UPDATE', [
      req.params.id,
    ]);
    const itemReq = reqResult.rows[0];
    if (!itemReq) throw new NotFoundError('Request not found');

    if (req.userId !== Number(itemReq.buyer_id)) {
      throw new UnauthorizedError('Only the buyer can cancel this request');
    }

    if (!['PENDING', 'ACCEPTED'].includes(itemReq.status)) {
      throw new ConflictError('This request cannot be cancelled at this stage');
    }

    // If cancelling an accepted request, restore reserved stock
    if (itemReq.status === 'ACCEPTED') {
      const listingRes = await client.query('SELECT * FROM listings WHERE id = $1 FOR UPDATE', [
        itemReq.listing_id,
      ]);
      const listing = listingRes.rows[0];
      if (listing) {
        const newReserved = Math.max(0, listing.qty_reserved - itemReq.quantity);
        const newAvailable = listing.qty_available + itemReq.quantity;
        const newStatus =
          listing.qty_total === 0 ? 'COMPLETED' : newAvailable > 0 ? 'AVAILABLE' : listing.status;

        await client.query(
          `UPDATE listings
           SET qty_reserved = $1, qty_available = $2, status = $3, updated_at = NOW()
           WHERE id = $4`,
          [newReserved, newAvailable, newStatus, listing.id]
        );
      }
    }

    const updateRes = await client.query(
      `UPDATE item_requests
       SET status = 'CANCELLED', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [itemReq.id]
    );

    await client.query('COMMIT');

    const dto = await toItemRequestDto(updateRes.rows[0], req.userId);
    res.json({
      success: true,
      message: 'Request cancelled',
      data: dto,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ── PATCH /api/v1/requests/:id/confirm-completion ─────────────────────────────
router.patch('/:id/confirm-completion', authenticate, async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reqResult = await client.query('SELECT * FROM item_requests WHERE id = $1 FOR UPDATE', [
      req.params.id,
    ]);
    const itemReq = reqResult.rows[0];
    if (!itemReq) throw new NotFoundError('Request not found');

    const isBuyer = req.userId === Number(itemReq.buyer_id);
    const isSeller = req.userId === Number(itemReq.seller_id);

    if (!isBuyer && !isSeller) {
      throw new UnauthorizedError('Only exchange participants can confirm completion');
    }

    if (itemReq.status !== 'ACCEPTED') {
      throw new ConflictError('Only accepted requests can be confirmed for completion');
    }

    const checkConfirm = await client.query(
      'SELECT id FROM exchange_confirmations WHERE request_id = $1 AND confirmed_by = $2',
      [itemReq.id, req.userId]
    );
    if (checkConfirm.rows.length > 0) {
      throw new ConflictError('You have already submitted confirmation for this exchange');
    }

    const listingResult = await client.query('SELECT * FROM listings WHERE id = $1', [itemReq.listing_id]);
    const listing = listingResult.rows[0];
    if (!listing) throw new NotFoundError('Listing not found');

    const confirmationType = listing.transaction_type === 'SELL' ? 'SALE_COMPLETED' : 'ITEM_RETURNED';

    await client.query(
      `INSERT INTO exchange_confirmations (request_id, confirmed_by, confirmation_type)
       VALUES ($1, $2, $3)`,
      [itemReq.id, req.userId, confirmationType]
    );

    const countResult = await client.query(
      'SELECT COUNT(*) FROM exchange_confirmations WHERE request_id = $1 AND confirmation_type = $2',
      [itemReq.id, confirmationType]
    );
    const totalConfirmations = parseInt(countResult.rows[0].count, 10);

    if (totalConfirmations >= 2) {
      // Both parties have confirmed: finalize inventory under lock
      const lockedListingRes = await client.query('SELECT * FROM listings WHERE id = $1 FOR UPDATE', [
        listing.id,
      ]);
      const lockedListing = lockedListingRes.rows[0];

      if (lockedListing) {
        const isPermanentSale = lockedListing.transaction_type === 'SELL';
        const newReserved = Math.max(0, lockedListing.qty_reserved - itemReq.quantity);
        let newTotal = lockedListing.qty_total;
        let newAvailable = lockedListing.qty_available;

        if (isPermanentSale) {
          newTotal = Math.max(0, lockedListing.qty_total - itemReq.quantity);
        } else {
          newAvailable = lockedListing.qty_available + itemReq.quantity;
        }

        const newStatus =
          newTotal === 0 ? 'COMPLETED' : newAvailable > 0 ? 'AVAILABLE' : lockedListing.status;

        await client.query(
          `UPDATE listings
           SET qty_reserved = $1, qty_total = $2, qty_available = $3, status = $4, updated_at = NOW()
           WHERE id = $5`,
          [newReserved, newTotal, newAvailable, newStatus, lockedListing.id]
        );
      }

      const updateReq = await client.query(
        `UPDATE item_requests
         SET status = 'COMPLETED', updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [itemReq.id]
      );

      await client.query('COMMIT');

      // Notify other peer
      const peerId = isBuyer ? itemReq.seller_id : itemReq.buyer_id;
      sendNotification(
        peerId,
        'EXCHANGE_COMPLETED',
        'Exchange Finalized',
        `Exchange for "${listing.title}" is officially confirmed and complete by both parties!`,
        'REQUEST',
        itemReq.id
      );

      const dto = await toItemRequestDto(updateReq.rows[0], req.userId);
      return res.json({
        success: true,
        message: 'Both parties have confirmed! Exchange successfully finalized.',
        data: dto,
      });
    }

    const refreshedReq = await client.query('SELECT * FROM item_requests WHERE id = $1', [itemReq.id]);
    await client.query('COMMIT');

    // Notify peer that other classmate confirmed
    const otherPeerId = isBuyer ? itemReq.seller_id : itemReq.buyer_id;
    sendNotification(
      otherPeerId,
      'CONFIRMATION_PENDING',
      'Action Required: Confirm Exchange',
      'Your classmate has confirmed the exchange. Please submit your confirmation to finalize it.',
      'REQUEST',
      itemReq.id
    );

    const dto = await toItemRequestDto(refreshedReq.rows[0], req.userId);
    res.json({
      success: true,
      message: 'Your confirmation has been recorded! Waiting for classmate to confirm.',
      data: dto,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// PRIVATE MESSAGING (MessageController endpoints)
// ══════════════════════════════════════════════════════════════════════════════

// ── GET /api/v1/requests/:requestId/messages ─────────────────────────────────
router.get('/:requestId/messages', authenticate, async (req, res, next) => {
  try {
    const reqResult = await pool.query('SELECT * FROM item_requests WHERE id = $1', [
      req.params.requestId,
    ]);
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

    // Query messages from MongoDB if connected, otherwise fallback to PostgreSQL
    if (mongoose.connection.readyState === 1) {
      const msgs = await Message.find({ requestId: Number(req.params.requestId) })
        .sort({ createdAt: 1 })
        .lean();

      return res.json({
        success: true,
        data: msgs.map(m => ({
          id: m._id.toString(),
          requestId: Number(m.requestId),
          senderId: Number(m.senderId),
          senderName: m.senderName || 'Student',
          body: m.body,
          createdAt: m.createdAt,
        })),
      });
    }

    const msgs = await pool.query(
      `SELECT m.*, u.full_name AS sender_name
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.request_id = $1
       ORDER BY m.created_at ASC`,
      [req.params.requestId]
    );

    const data = msgs.rows.map(m => ({
      id: Number(m.id),
      requestId: Number(m.request_id),
      senderId: Number(m.sender_id),
      senderName: m.sender_name || 'Student',
      body: m.body,
      createdAt: m.created_at,
    }));

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/v1/requests/:requestId/messages ────────────────────────────────
router.post('/:requestId/messages', authenticate, async (req, res, next) => {
  try {
    const reqResult = await pool.query('SELECT * FROM item_requests WHERE id = $1', [
      req.params.requestId,
    ]);
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

    // Store in MongoDB if connected
    if (mongoose.connection.readyState === 1) {
      const newMsg = await Message.create({
        requestId: Number(req.params.requestId),
        senderId: req.userId,
        senderName,
        body: trimmedBody,
      });

      // Update Conversation record in MongoDB
      const listingRes = await pool.query('SELECT title FROM listings WHERE id = $1', [
        itemReq.listing_id,
      ]);
      const listingTitle = listingRes.rows[0]?.title || '';

      await Conversation.findOneAndUpdate(
        { requestId: Number(req.params.requestId) },
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
          requestId: Number(newMsg.requestId),
          senderId: Number(newMsg.senderId),
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
      [req.params.requestId, req.userId, trimmedBody]
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
