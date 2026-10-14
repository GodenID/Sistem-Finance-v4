const express = require('express');
const router = express.Router();
const kasbonController = require('../controllers/kasbonController');
const { authenticateToken, requireRole, requireFinance, requireBOD, requireAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET all kasbon
router.get('/', kasbonController.getAll);

// GET single kasbon by ID
router.get('/:id', kasbonController.getById);

// GET kasbon by nomor
router.get('/nomor/:nomor', kasbonController.getByNomor);

// POST create kasbon
router.post('/', kasbonController.create);

// PUT update kasbon
router.put('/:id', kasbonController.update);

// PATCH update approval status (Manager tahap 1, Head Finance/BOD tahap 2, Admin)
router.patch('/:id/approval', requireRole('administrator', 'bod', 'manager', 'head_finance'), kasbonController.updateApproval);

// PATCH update transfer status (Finance only)
router.patch('/:id/transfer', requireFinance, kasbonController.updateTransfer);

// DELETE kasbon
router.delete('/:id', kasbonController.remove);

// POST bulk delete (Admin only)
router.post('/bulk-delete', requireAdmin, kasbonController.bulkDelete);

module.exports = router;
