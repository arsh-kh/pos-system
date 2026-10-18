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
router.post('/telegram/recipients', telegramBackupController.addRecipient);
router.put('/telegram/recipients/:id', telegramBackupController.updateRecipient);
router.post('/telegram/recipients/:id/update', telegramBackupController.updateRecipient);
router.post('/telegram/recipients/:id/toggle', telegramBackupController.toggleRecipient);
router.delete('/telegram/recipients/:id', telegramBackupController.deleteRecipient);
router.post('/telegram/recipients/:id/test', telegramBackupController.testRecipient);
router.post('/telegram/toggle-auto', telegramBackupController.toggleAutoBackup);
router.post('/telegram/send', telegramBackupController.sendBackupToTelegram);
router.post('/telegram/send-snapshot/:filename', telegramBackupController.sendSnapshotToTelegram);
router.post('/telegram/auto-detect', telegramBackupController.autoDetectChatId);
router.post('/telegram/trigger-nightly', telegramBackupController.triggerNightlySummary);
router.get('/telegram/daily-summary', telegramBackupController.getDailySummary);

module.exports = router;

