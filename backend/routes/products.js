const express = require('express');
const router = express.Router();
const productsController = require('../controllers/products');

// router.use(authenticateToken); // Temporarily disabled for UI testing

router.get('/', productsController.getAllProducts);
router.post('/', productsController.addProduct);
router.put('/:id', productsController.updateProduct);
router.delete('/:id', productsController.deleteProduct);

module.exports = router;
