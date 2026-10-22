const express = require('express');
const router = express.Router();
const returnsController = require('../controllers/returns');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

// router.use(authenticateToken);

router.post('/', returnsController.processReturn);
router.post('/direct', returnsController.processDirectReturn);
router.get('/', returnsController.getReturnsHistory);
router.get('/sale/:id', returnsController.getSaleForReturn);

module.exports = router;
