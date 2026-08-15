const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const createRateLimiter = require('../middleware/rateLimiter');

// Teacher Session Control
router.post('/session/start', authenticateToken, requireRole('teacher'), attendanceController.startSession);
router.post('/session/:sessionId/end', authenticateToken, requireRole('teacher'), attendanceController.endSession);
router.get('/session/:sessionId/projector-token', attendanceController.getProjectorToken);
router.get('/session/:sessionId/live-status', authenticateToken, attendanceController.getSessionLiveStatus);
router.post('/override/:recordId', authenticateToken, requireRole('teacher'), attendanceController.overrideAttendance);

// Student Verification Endpoint (Rate limited to prevent hammer attacks)
router.post('/verify', authenticateToken, requireRole('student'), createRateLimiter(10, 30), attendanceController.verifyAttendance);

module.exports = router;
