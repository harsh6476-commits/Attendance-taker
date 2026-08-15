const express = require('express');
const router = express.Router();
const classController = require('../controllers/classController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// Teacher Classroom Routes
router.post('/create', authenticateToken, requireRole('teacher'), classController.createClass);
router.post('/:classId/enroll', authenticateToken, requireRole('teacher'), classController.enrollStudents);
router.post('/:classId/geofence', authenticateToken, requireRole('teacher'), classController.registerGeofence);
router.get('/teacher', authenticateToken, requireRole('teacher'), classController.getTeacherClasses);

// Student Classroom Routes
router.post('/join', authenticateToken, requireRole('student'), classController.joinClass);
router.get('/student', authenticateToken, requireRole('student'), classController.getStudentClasses);

// General Details
router.get('/:classId', authenticateToken, classController.getClassDetails);

module.exports = router;
