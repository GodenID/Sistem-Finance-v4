const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activityLogController');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET all activity logs
router.get('/', activityLogController.getAll);

// GET activity logs by record ID
router.get('/record/:recordId', activityLogController.getByRecordId);

// POST create activity log
router.post('/', activityLogController.create);

module.exports = router;
