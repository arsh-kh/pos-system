const express = require('express');
const router = express.Router();
const controller = require('../controllers/inventory_audit');

router.post('/reconcile', controller.reconcileProductStock);
router.get('/history', controller.getAuditHistory);
router.get('/stats', controller.getAuditStats);
router.delete('/:id', controller.revertAudit);

module.exports = router;
