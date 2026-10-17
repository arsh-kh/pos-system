const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backup');

// Backup routes
router.get('/', backupController.downloadBackup);
router.get('/stats', backupController.getBackupStats);
router.get('/local-snapshots', backupController.listLocalSnapshots);
router.get('/download-snapshot/:filename', backupController.downloadLocalSnapshot);
router.post('/create-snapshot', backupController.createManualSnapshot);
router.delete('/snapshots/:filename', backupController.deleteLocalSnapshot);
router.post('/restore', backupController.restoreBackup);
router.post('/restore-local', backupController.restoreFromLocal);

module.exports = router;

