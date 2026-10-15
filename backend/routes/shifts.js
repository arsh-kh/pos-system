const express = require('express');
const router = express.Router();
const shiftsController = require('../controllers/shifts');

router.get('/current', shiftsController.getCurrentShift);
router.post('/open', shiftsController.openShift);
router.post('/close/:id', shiftsController.closeShift);
router.get('/all', shiftsController.getAllShifts);

module.exports = router;
