// routes/admin.js — Admin-only routes (requires ADMIN role)
const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const { listReports, getReport, updateReport } = require('../controllers/reportController');

const router = express.Router();

// All admin routes require auth + ADMIN role
router.use(authenticate, requireAdmin);

// Dashboard
router.get('/dashboard', adminController.getDashboard);

// User management
router.get('/users', adminController.listUsers);
router.patch('/users/:id/suspend', adminController.suspendUser);
router.patch('/users/:id/reactivate', adminController.reactivateUser);

// Listing management
router.get('/listings', adminController.listListings);
router.delete('/listings/:id', adminController.removeListing);

// Report management
router.get('/reports', listReports);
router.get('/reports/:id', getReport);
router.patch('/reports/:id', updateReport);

// Category management
router.get('/categories', adminController.listCategories);
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.patch('/categories/:id/toggle', adminController.toggleCategory);

// Audit logs
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;
