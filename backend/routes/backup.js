const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backup');
const telegramBackupController = require('../controllers/telegram_backup');

// Backup routes
router.get('/', backupController.downloadBackup);
router.get('/stats', backupController.getBackupStats);
router.get('/local-snapshots', backupController.listLocalSnapshots);
router.get('/download-snapshot/:filename', backupController.downloadLocalSnapshot);
router.post('/create-snapshot', backupController.createManualSnapshot);
router.delete('/snapshots/:filename', backupController.deleteLocalSnapshot);
router.post('/restore', backupController.restoreBackup);
router.post('/restore-local', backupController.restoreFromLocal);

// Telegram Cloud Backup routes
router.get('/telegram/settings', telegramBackupController.getTelegramSettings);
router.post('/telegram/settings', telegramBackupController.updateTelegramSettings);
router.post('/telegram/test', telegramBackupController.testTelegramConnection);
router.post('/telegram/send', telegramBackupController.sendBackupToTelegram);
router.post('/telegram/send-snapshot/:filename', telegramBackupController.sendSnapshotToTelegram);

module.exports = router;

