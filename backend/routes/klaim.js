const express = require('express');
const router = express.Router();
const klaimController = require('../controllers/klaimController');
const { authenticateToken, requireFinance, requireBOD, requireAdmin } = require('../middleware/auth');

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

// PATCH update approval status (BOD only)
router.patch('/:id/approval', requireBOD, klaimController.updateApproval);

// PATCH update transfer status (Finance only)
router.patch('/:id/transfer', requireFinance, klaimController.updateTransfer);

// DELETE klaim
router.delete('/:id', klaimController.remove);

// POST bulk delete (Admin only)
router.post('/bulk-delete', requireAdmin, klaimController.bulkDelete);

module.exports = router;
