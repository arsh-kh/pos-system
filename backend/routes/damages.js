const express = require('express');
const router = express.Router();
const damagesController = require('../controllers/damages');

router.post('/', damagesController.recordDamage);
router.get('/', damagesController.getDamagesHistory);
router.get('/stats', damagesController.getDamagesStats);
router.delete('/:id', damagesController.deleteDamageRecord);

module.exports = router;
