const express = require('express');
const router = express.Router();
const shiftsController = require('../controllers/shifts');

router.get('/current', shiftsController.getCurrentShift);
router.post('/open', shiftsController.openShift);
router.post('/close/:id', shiftsController.closeShift);
router.get('/z-report/:id', shiftsController.getZReport);
router.post('/z-report/:id/telegram', shiftsController.sendZReportTelegram);
router.get('/all', shiftsController.getAllShifts);

module.exports = router;
