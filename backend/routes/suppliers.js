const express = require('express');
const router = express.Router();
const suppliersController = require('../controllers/suppliers');

router.get('/', suppliersController.getAllSuppliers);
router.post('/', suppliersController.addSupplier);
router.get('/:id', suppliersController.getSupplierProfile);
router.post('/:id/pay', suppliersController.paySupplierDebt);

module.exports = router;
