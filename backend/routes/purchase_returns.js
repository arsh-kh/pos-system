const express = require('express');
const router = express.Router();
const controller = require('../controllers/purchase_returns');

router.post('/', controller.createPurchaseReturn);
router.get('/', controller.getAllPurchaseReturns);

module.exports = router;
