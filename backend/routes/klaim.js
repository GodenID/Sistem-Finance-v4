const express = require('express');
const router = express.Router();
const klaimController = require('../controllers/klaimController');
const { authenticateToken, requireRole, requireFinance, requireBOD, requireAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET all klaim
router.get('/', klaimController.getAll);

// GET single klaim by ID
router.get('/:id', klaimController.getById);

// POST create klaim
router.post('/', klaimController.create);

// PUT update klaim
router.put('/:id', klaimController.update);

// PATCH update approval status (Manager tahap 1, Head Finance/BOD tahap 2, Admin)
router.patch('/:id/approval', requireRole('administrator', 'bod', 'manager', 'head_finance'), klaimController.updateApproval);

// PATCH update transfer status (Finance only)
router.patch('/:id/transfer', requireFinance, klaimController.updateTransfer);

// DELETE klaim
router.delete('/:id', klaimController.remove);

// POST bulk delete (Admin only)
router.post('/bulk-delete', requireAdmin, klaimController.bulkDelete);

module.exports = router;
