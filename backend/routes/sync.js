const express = require('express');
const router = express.Router();
const syncController = require('../controllers/sync');

// Sync endpoints
router.get('/status', syncController.getSyncStatus);
router.post('/trigger', syncController.triggerSync);
router.post('/settings', syncController.updateSettings);
router.post('/cleanup', syncController.cleanupSynced);

// Cloud Mock/Gateway endpoints
router.get('/cloud-health', syncController.cloudHealth);
router.post('/cloud-push', syncController.cloudPush);

module.exports = router;
