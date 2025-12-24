const express = require('express');
const router = express.Router();
const penyelesaianController = require('../controllers/penyelesaianController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

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

// DELETE penyelesaian
router.delete('/:id', penyelesaianController.remove);

// POST bulk delete (Admin only)
router.post('/bulk-delete', requireAdmin, penyelesaianController.bulkDelete);

module.exports = router;
