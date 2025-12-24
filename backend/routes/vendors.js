const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET all vendors
router.get('/', vendorController.getAll);

// GET single vendor by ID
router.get('/:id', vendorController.getById);

// POST create vendor (Admin only)
router.post('/', requireAdmin, vendorController.create);

// PUT update vendor (Admin only)
router.put('/:id', requireAdmin, vendorController.update);

// DELETE vendor (Admin only)
router.delete('/:id', requireAdmin, vendorController.remove);

module.exports = router;
