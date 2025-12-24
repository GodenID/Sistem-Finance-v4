const express = require('express');
const router = express.Router();
const recurringController = require('../controllers/recurringController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Transactions
router.get('/', recurringController.getAllTransactions);
router.post('/', recurringController.createTransaction);
router.put('/:id', recurringController.updateTransaction);
router.delete('/:id', recurringController.deleteTransaction);

module.exports = router;
