const express = require('express');
const router = express.Router();
const promotionsController = require('../controllers/promotions');

router.get('/', promotionsController.getAllPromotions);
router.get('/active', promotionsController.getActivePromotions);
router.post('/', promotionsController.createPromotion);
router.put('/:id', promotionsController.updatePromotion);
router.patch('/:id/toggle', promotionsController.togglePromotionStatus);
router.delete('/:id', promotionsController.deletePromotion);

module.exports = router;
