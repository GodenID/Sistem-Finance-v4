const express = require('express');
const router = express.Router();
const paymentRequestController = require('../controllers/paymentRequestController');
const { authenticateToken, requireRole, requireFinance, requireBOD, requireAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET all payment requests
router.get('/', paymentRequestController.getAll);

// GET single payment request
router.get('/:id', paymentRequestController.getById);

// POST create payment request
router.post('/', paymentRequestController.create);

// PUT update payment request
router.put('/:id', paymentRequestController.update);

// PATCH update approval status (Manager tahap 1, Head Finance/BOD tahap 2, Admin)
router.patch('/:id/approval', requireRole('administrator', 'bod', 'manager', 'head_finance'), paymentRequestController.updateApproval);

// PATCH update transfer status (Finance only)
router.patch('/:id/transfer', requireFinance, paymentRequestController.updateTransfer);

// DELETE payment request
router.delete('/:id', paymentRequestController.remove);

// POST bulk delete (Admin only)
router.post('/bulk-delete', requireAdmin, paymentRequestController.bulkDelete);

module.exports = router;
