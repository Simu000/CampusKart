// controllers/reportController.js — Report & Block controllers
const pool = require('../db/pool');
const reportRepository = require('../repositories/reportRepository');
const blockRepository = require('../repositories/blockRepository');
const auditRepository = require('../repositories/auditRepository');
const { toReportDto } = require('../dtos/listingDto');
const { sendNotification } = require('../services/notification');
const {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
  ConflictError,
} = require('../middleware/errors');

// ── POST /api/v1/reports ─────────────────────────────────────────────────────
async function createReport(req, res, next) {
  try {
    const { reportedUserId, listingId, reason, description } = req.body;

    const VALID_REASONS = [
      'INAPPROPRIATE_CONTENT', 'FAKE_OR_MISLEADING', 'SPAM',
      'HARASSMENT', 'PROHIBITED_ITEM', 'SUSPECTED_SCAM', 'OTHER',
    ];

    if (!reason || !VALID_REASONS.includes(reason.toUpperCase())) {
      throw new BadRequestError(`Reason must be one of: ${VALID_REASONS.join(', ')}`);
    }

    if (!reportedUserId && !listingId) {
      throw new BadRequestError('A report must target either a user or a listing');
    }

    // Cannot report yourself
    if (reportedUserId && Number(reportedUserId) === req.userId) {
      throw new BadRequestError('You cannot report yourself');
    }

    const report = await reportRepository.create({
      reporterId: req.userId,
      reportedUserId: reportedUserId ? Number(reportedUserId) : null,
      listingId: listingId ? Number(listingId) : null,
      reason: reason.toUpperCase(),
      description,
    });

    res.status(201).json({
      success: true,
      message: 'Your report has been submitted and will be reviewed by our moderation team.',
      data: { id: Number(report.id) },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/admin/reports ─────────────────────────────────────────────────
async function listReports(req, res, next) {
  try {
    const { status = '', page = '0', size = '20' } = req.query;
    const pageNum = Math.max(0, parseInt(page, 10) || 0);
    const pageSize = Math.min(Math.max(1, parseInt(size, 10) || 20), 50);

    const [reports, total] = await Promise.all([
      reportRepository.findAll({ status, page: pageNum, size: pageSize }),
      reportRepository.countAll(status),
    ]);

    res.json({
      success: true,
      data: {
        items: reports.map(toReportDto),
        total,
        page: pageNum,
        size: pageSize,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/admin/reports/:id ─────────────────────────────────────────────
async function getReport(req, res, next) {
  try {
    const report = await reportRepository.findById(req.params.id);
    if (!report) throw new NotFoundError('Report not found');
    res.json({ success: true, data: toReportDto(report) });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/v1/admin/reports/:id ───────────────────────────────────────────
async function updateReport(req, res, next) {
  try {
    const { status, adminNotes } = req.body;
    const VALID_STATUSES = ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'];

    if (!status || !VALID_STATUSES.includes(status.toUpperCase())) {
      throw new BadRequestError(`Status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const existing = await reportRepository.findById(req.params.id);
    if (!existing) throw new NotFoundError('Report not found');

    const updated = await reportRepository.update(req.params.id, {
      status: status.toUpperCase(),
      adminNotes,
      reviewedBy: req.userId,
    });

    // Log admin action
    await auditRepository.log({
      actorId: req.userId,
      action: 'REPORT_REVIEWED',
      targetType: 'REPORT',
      targetId: req.params.id,
      reason: `Status set to ${status}. ${adminNotes || ''}`,
    });

    res.json({ success: true, message: 'Report updated', data: toReportDto(updated) });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/v1/users/:id/block ──────────────────────────────────────────────
async function blockUser(req, res, next) {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (targetId === req.userId) throw new BadRequestError('You cannot block yourself');

    // Verify target exists
    const target = await pool.query('SELECT id FROM users WHERE id = $1', [targetId]);
    if (target.rows.length === 0) throw new NotFoundError('User not found');

    await blockRepository.block(req.userId, targetId);

    res.json({
      success: true,
      message: 'User blocked. They can no longer contact you or view your listings.',
      data: null,
    });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/v1/users/:id/block ────────────────────────────────────────────
async function unblockUser(req, res, next) {
  try {
    const targetId = parseInt(req.params.id, 10);
    await blockRepository.unblock(req.userId, targetId);
    res.json({ success: true, message: 'User unblocked', data: null });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/v1/users/me/blocked ──────────────────────────────────────────────
async function getBlockedList(req, res, next) {
  try {
    const list = await blockRepository.getBlockedList(req.userId);
    res.json({
      success: true,
      data: list.map(u => ({
        id: Number(u.id),
        fullName: u.full_name,
        department: u.department || null,
        profileImageUrl: u.profile_image_url || null,
        blockedAt: u.blocked_at,
      })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createReport,
  listReports,
  getReport,
  updateReport,
  blockUser,
  unblockUser,
  getBlockedList,
};
