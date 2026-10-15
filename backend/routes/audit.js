const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit');

router.get('/', auditController.getAuditLogs);

module.exports = router;
