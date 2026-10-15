const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics');
// const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

// Dashboard & Hourly
router.get('/dashboard', analyticsController.getDashboardStats);
router.get('/hourly', analyticsController.getHourlyStats);

// Phase 8: Total Sales & Deep Analytics
router.get('/overview', analyticsController.getOverview);
router.get('/month-days', analyticsController.getMonthDays);
router.get('/day-hours', analyticsController.getDayHours);
router.post('/manual-sale', analyticsController.addManualSale);

module.exports = router;
