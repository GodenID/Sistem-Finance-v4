const express = require('express');
const router = express.Router();
const recurringController = require('../controllers/recurringController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// Instances
router.get('/', recurringController.getAllInstances);
router.post('/', recurringController.createInstance);
router.put('/:id', recurringController.updateInstance);
// Delete if needed, but not currently used in frontend refactor logic I saw

module.exports = router;
