const express = require('express');
const router = express.Router();
const penyelesaianController = require('../controllers/penyelesaianController');
const { authenticateToken, requireRole, requireFinance, requireAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET all penyelesaian
router.get('/', penyelesaianController.getAll);

// GET single penyelesaian by ID
router.get('/:id', penyelesaianController.getById);

// GET check if kasbon has penyelesaian
router.get('/check-kasbon/:nomor_kasbon', penyelesaianController.checkKasbonPenyelesaian);

// POST create penyelesaian
router.post('/', penyelesaianController.create);

// PUT update penyelesaian
router.put('/:id', penyelesaianController.update);

// PATCH update approval status (Manager tahap 1, Head Finance/BOD tahap 2, Admin)
router.patch('/:id/approval', requireRole('administrator', 'bod', 'manager', 'head_finance'), penyelesaianController.updateApproval);

// PATCH update transfer status (Finance only)
router.patch('/:id/transfer', requireFinance, penyelesaianController.updateTransfer);

// DELETE penyelesaian
router.delete('/:id', penyelesaianController.remove);

// POST bulk delete (Admin only)
router.post('/bulk-delete', requireAdmin, penyelesaianController.bulkDelete);

module.exports = router;
