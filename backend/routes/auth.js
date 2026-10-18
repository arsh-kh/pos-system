const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

router.post('/login', authController.login);
router.post('/change-password', authController.changePassword);

// Only admins can register new staff
router.post('/register', authenticateToken, requireAdmin, authController.register);

module.exports = router;
