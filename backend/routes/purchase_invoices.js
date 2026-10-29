const express = require('express');
const router = express.Router();
const invoicesController = require('../controllers/purchase_invoices');

router.post('/', invoicesController.createPurchaseInvoice);
router.post('/generate-pdf', invoicesController.generateInvoicePdf);
router.get('/', invoicesController.getAllPurchaseInvoices);
router.get('/:id', invoicesController.getPurchaseInvoiceDetails);

module.exports = router;
