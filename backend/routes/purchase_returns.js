const express = require('express');
const router = express.Router();
const controller = require('../controllers/purchase_returns');

router.post('/', controller.createPurchaseReturn);
router.get('/', controller.getAllPurchaseReturns);
router.get('/stats', controller.getPurchaseReturnsStats);
router.delete('/:id', controller.deletePurchaseReturn);

module.exports = router;
