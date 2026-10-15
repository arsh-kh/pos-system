const express = require('express');
const router = express.Router();
const checkoutController = require('../controllers/checkout');

router.post('/', checkoutController.processCheckout);
router.get('/', checkoutController.getAllSales);
router.get('/:id', checkoutController.getSaleDetails);

module.exports = router;

