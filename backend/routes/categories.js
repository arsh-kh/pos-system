const express = require('express');
const router = express.Router();
const categoriesController = require('../controllers/categories');

// router.use(authenticateToken); // Temporarily disabled

router.get('/', categoriesController.getAllCategories);
router.post('/', categoriesController.addCategory);
router.delete('/:id', categoriesController.deleteCategory);

module.exports = router;
