const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

router.get('/session/:sessionId/excel', authenticateToken, requireRole('teacher'), reportController.exportClassSessionExcel);
router.get('/class/:classId/excel', authenticateToken, requireRole('teacher'), reportController.exportClassCumulativeExcel);

module.exports = router;
