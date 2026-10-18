const express = require('express');
const router = express.Router();
const usersController = require('../controllers/users');
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

  // Fallback to local session header
  if (req.headers['x-user-role'] === 'ADMIN') {
    req.user = { role: 'ADMIN', username: req.headers['x-user-name'] || 'admin' };
    return next();
  }

  return res.status(403).json({
    status: 'ERROR',
    message: 'دەسەڵاتی بەڕێوەبەر (Admin) پێویستە بۆ بەڕێوەبردنی کاشێرەکان'
  });
};

// Public/POS route: get cashiers list for login selection
router.get('/cashiers', usersController.getCashiers);

// Admin routes:
router.get('/', checkAdminRole, usersController.getAllUsers);
router.post('/cashiers', checkAdminRole, usersController.createCashier);
router.put('/cashiers/:id', checkAdminRole, usersController.updateCashier);
router.delete('/cashiers/:id', checkAdminRole, usersController.deleteCashier);

module.exports = router;
