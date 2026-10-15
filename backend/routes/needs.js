const express = require('express');
const router = express.Router();
const needsController = require('../controllers/needs');

router.get('/', needsController.getNeeds);
router.get('/categories', needsController.getNeedsCategories);
router.post('/categories', needsController.addNeedsCategory);
router.post('/', needsController.addNeed);
router.put('/:id/fulfill', needsController.markFulfilled);
router.delete('/:id', needsController.deleteNeed);

module.exports = router;
