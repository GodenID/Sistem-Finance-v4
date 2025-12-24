const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const upload = require('../middleware/upload');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// POST upload single file
router.post('/single', upload.single('file'), uploadController.uploadSingle);

// POST upload multiple files
router.post('/multiple', upload.array('files', 10), uploadController.uploadMultiple);

module.exports = router;
