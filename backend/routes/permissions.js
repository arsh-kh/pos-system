const express = require('express');
const router = express.Router();
const permissionsController = require('../controllers/permissions');
const jwt = require('jsonwebtoken');

// Middleware to verify admin via JWT or local header
const checkAdminRole = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
      if (decoded && decoded.role === 'ADMIN') {
        req.user = decoded;
        return next();
      }
    } catch (_) {}
  }

  // Fallback to local session header if token is missing
  if (req.headers['x-user-role'] === 'ADMIN') {
    req.user = { role: 'ADMIN', username: req.headers['x-user-name'] || 'admin' };
    return next();
  }

  return res.status(403).json({
    status: 'ERROR',
    message: 'دەسەڵاتی ئەدمین پێویستە بۆ گۆڕینی ڕێکخستنەکانی کاشێر'
  });
};

// Get cashier permissions - accessible to all sessions
router.get('/cashier', permissionsController.getCashierPermissions);

// Update cashier permissions - restricted to Admin
router.put('/cashier', checkAdminRole, permissionsController.updateCashierPermissions);

module.exports = router;
