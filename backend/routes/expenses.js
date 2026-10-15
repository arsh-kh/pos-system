const express = require('express');
const router = express.Router();
const controller = require('../controllers/expenses');

router.post('/', controller.createExpense);
router.get('/', controller.getAllExpenses);
router.get('/summary', controller.getExpenseSummary);
router.delete('/:id', controller.deleteExpense);

module.exports = router;
