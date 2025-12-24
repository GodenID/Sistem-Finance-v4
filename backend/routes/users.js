const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET all users - Authenticated users can list users
router.get('/', userController.getAll);

// GET single user by ID - Authenticated users can view profiles
router.get('/:id', userController.getById);

// GET user stats - Authenticated users can view stats
router.get('/:id/stats', userController.getStats);

// POST create user - Admin only
router.post('/', requireAdmin, userController.create);

// PUT update user - Controller checks if own profile or Admin
router.put('/:id', userController.update);

// DELETE user - Admin only
router.delete('/:id', requireAdmin, userController.remove);

module.exports = router;
