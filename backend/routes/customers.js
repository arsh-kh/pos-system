const express = require('express');
const router = express.Router();
const customersController = require('../controllers/customers');

// router.use(authenticateToken); // Temporarily disabled for UI testing

router.get('/', customersController.getAllCustomers);
router.post('/', customersController.addCustomer);
router.get('/:id', customersController.getCustomerProfile);
router.post('/:id/debts', customersController.addDebtTransaction);

module.exports = router;
