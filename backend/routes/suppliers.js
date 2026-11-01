const express = require('express');
const router = express.Router();
const suppliersController = require('../controllers/suppliers');

router.get('/', suppliersController.getAllSuppliers);
router.post('/', suppliersController.addSupplier);
router.get('/:id', suppliersController.getSupplierProfile);
router.put('/:id', suppliersController.updateSupplier);
router.delete('/:id', suppliersController.deleteSupplier);
router.post('/:id/pay', suppliersController.paySupplierDebt);

module.exports = router;
