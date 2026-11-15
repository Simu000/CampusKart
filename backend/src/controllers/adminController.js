const pool = require('../db/pool');
const userRepository = require('../repositories/userRepository');
const listingRepository = require('../repositories/listingRepository');
const auditRepository = require('../repositories/auditRepository');
const categoryRepository = require('../repositories/categoryRepository');
const { toUserSummaryDto, toAdminUserDto } = require('../dtos/userDto');
const { toListingDto } = require('../dtos/listingDto');
const { sendNotification } = require('../services/notification');
const {
  NotFoundError,
  BadRequestError,
  ConflictError,
} = require('../middleware/errors');

async function getDashboard(req, res, next) {
  try {
    const [
      totalUsers,
      verifiedUsers,
      activeListings,
      pendingReports,
      totalRequests,
      completedExchanges,
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM users WHERE verified = TRUE'),
      pool.query("SELECT COUNT(*) FROM listings WHERE status NOT IN ('REMOVED', 'COMPLETED')"),
      pool.query("SELECT COUNT(*) FROM reports WHERE status = 'PENDING'"),
      pool.query('SELECT COUNT(*) FROM item_requests'),
      pool.query("SELECT COUNT(*) FROM item_requests WHERE status = 'COMPLETED'"),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers: parseInt(totalUsers.rows[0].count, 10),
        verifiedUsers: parseInt(verifiedUsers.rows[0].count, 10),
        activeListings: parseInt(activeListings.rows[0].count, 10),
        pendingReports: parseInt(pendingReports.rows[0].count, 10),
        totalRequests: parseInt(totalRequests.rows[0].count, 10),
        completedExchanges: parseInt(completedExchanges.rows[0].count, 10),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    const { search = '', page = '0', size = '20' } = req.query;
    const pageNum = Math.max(0, parseInt(page, 10) || 0);
    const pageSize = Math.min(Math.max(1, parseInt(size, 10) || 20), 50);

    const [users, total] = await Promise.all([
      userRepository.findAll({ search, page: pageNum, size: pageSize }),
      userRepository.countAll(search),
    ]);

    res.json({
      success: true,
      data: {
        items: users.map(toAdminUserDto),
        total,
        page: pageNum,
        size: pageSize,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function suspendUser(req, res, next) {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { reason = 'Policy violation' } = req.body;

    if (targetId === req.userId) throw new BadRequestError('Administrators cannot suspend themselves');

    const user = await userRepository.findById(targetId);
    if (!user) throw new NotFoundError('User not found');
    if (user.role === 'ADMIN') throw new BadRequestError('Cannot suspend another administrator');
    if (user.status === 'SUSPENDED') throw new ConflictError('Account is already suspended');

    await userRepository.updateStatus(targetId, 'SUSPENDED');

    // Notify user
    sendNotification(
      targetId,
      'ACCOUNT_SUSPENDED',
      'Account Suspended',
      'Your Campus Exchange account has been suspended. Contact campus support if you believe this is an error.',
      'USER',
      targetId
    );

    // Audit log
    await auditRepository.log({
      actorId: req.userId,
      action: 'USER_SUSPENDED',
      targetType: 'USER',
      targetId,
      reason,
    });

    res.json({ success: true, message: 'Account suspended', data: null });
  } catch (err) {
    next(err);
  }
}

async function reactivateUser(req, res, next) {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { reason = 'Appeal approved' } = req.body;

    const user = await userRepository.findById(targetId);
    if (!user) throw new NotFoundError('User not found');
    if (user.status === 'ACTIVE') throw new ConflictError('Account is already active');

    await userRepository.updateStatus(targetId, 'ACTIVE');

    // Notify user
    sendNotification(
      targetId,
      'ACCOUNT_REACTIVATED',
      'Account Reactivated',
      'Your Campus Exchange account has been reactivated. Welcome back!',
      'USER',
      targetId
    );

    await auditRepository.log({
      actorId: req.userId,
      action: 'USER_REACTIVATED',
      targetType: 'USER',
      targetId,
      reason,
    });

    res.json({ success: true, message: 'Account reactivated', data: null });
  } catch (err) {
    next(err);
  }
}

async function listListings(req, res, next) {
  try {
    const { search = '', page = '0', size = '20' } = req.query;
    const pageNum = Math.max(0, parseInt(page, 10) || 0);
    const pageSize = Math.min(Math.max(1, parseInt(size, 10) || 20), 50);

    const rows = await listingRepository.findAllAdmin({ search, page: pageNum, size: pageSize });
    const dtos = await Promise.all(rows.map(toListingDto));

    res.json({
      success: true,
      data: {
        items: dtos,
        page: pageNum,
        size: pageSize,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function removeListing(req, res, next) {
  try {
    const listingId = parseInt(req.params.id, 10);
    const { reason = 'Policy violation' } = req.body;

    const listing = await listingRepository.findById(listingId);
    if (!listing) throw new NotFoundError('Listing not found');
    if (listing.status === 'REMOVED') throw new ConflictError('Listing already removed');

    await listingRepository.softDelete(listingId);

    // Notify seller
    sendNotification(
      listing.seller_id,
      'LISTING_REMOVED',
      'Listing Removed',
      `Your listing "${listing.title}" has been removed by the moderation team. Contact campus support for more details.`,
      'LISTING',
      listingId
    );

    await auditRepository.log({
      actorId: req.userId,
      action: 'LISTING_REMOVED',
      targetType: 'LISTING',
      targetId: listingId,
      reason,
    });

    res.json({ success: true, message: 'Listing removed', data: null });
  } catch (err) {
    next(err);
  }
}

async function listCategories(req, res, next) {
  try {
    const cats = await categoryRepository.findAll(false); // all, including inactive
    res.json({ success: true, data: cats });
  } catch (err) {
    next(err);
  }
}

async function createCategory(req, res, next) {
  try {
    const { name, slug, description, imageUrl, displayOrder } = req.body;
    if (!name || !name.trim()) throw new BadRequestError('Category name is required');

    const existing = await categoryRepository.findByName(name.trim());
    if (existing) throw new ConflictError('A category with this name already exists');

    const cat = await categoryRepository.create({ name: name.trim(), slug, description, imageUrl, displayOrder });

    await auditRepository.log({
      actorId: req.userId,
      action: 'CATEGORY_CREATED',
      targetType: 'CATEGORY',
      targetId: cat.id,
      reason: `Created category: ${cat.name}`,
    });

    res.status(201).json({ success: true, message: 'Category created', data: cat });
  } catch (err) {
    next(err);
  }
}

async function updateCategory(req, res, next) {
  try {
    const { name, slug, description, imageUrl, displayOrder } = req.body;
    if (!name || !name.trim()) throw new BadRequestError('Category name is required');

    const existing = await categoryRepository.findById(req.params.id);
    if (!existing) throw new NotFoundError('Category not found');

    const updated = await categoryRepository.update(req.params.id, {
      name: name.trim(), slug, description, imageUrl, displayOrder,
    });

    res.json({ success: true, message: 'Category updated', data: updated });
  } catch (err) {
    next(err);
  }
}

async function toggleCategory(req, res, next) {
  try {
    const existing = await categoryRepository.findById(req.params.id);
    if (!existing) throw new NotFoundError('Category not found');

    const updated = await categoryRepository.setActive(req.params.id, !existing.active);

    res.json({
      success: true,
      message: updated.active ? 'Category activated' : 'Category deactivated',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

async function getAuditLogs(req, res, next) {
  try {
    const { page = '0', size = '50' } = req.query;
    const logs = await auditRepository.findRecent({
      page: parseInt(page, 10) || 0,
      size: Math.min(parseInt(size, 10) || 50, 100),
    });
    res.json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDashboard,
  listUsers,
  suspendUser,
  reactivateUser,
  listListings,
  removeListing,
  listCategories,
  createCategory,
  updateCategory,
  toggleCategory,
  getAuditLogs,
};
