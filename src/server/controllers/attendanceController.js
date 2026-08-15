const jwt = require('jsonwebtoken');
const config = require('../config');
const cache = require('../utils/cache');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const AttendanceAuditLog = require('../models/AttendanceAuditLog');
const Class = require('../models/Class');
const ClassEnrollment = require('../models/ClassEnrollment');
const { generateDynamicToken, verifyDynamicToken } = require('../utils/secretDerivation');
const { evaluateLocationConfidence } = require('../utils/haversine');

/**
 * Teacher Starts Attendance Session
 */
async function startSession(req, res) {
  try {
    const { classId, durationMinutes = 5, mode = 'fast' } = req.body;

    const classObj = await Class.findOne({ _id: classId, teacherId: req.user._id });
    if (!classObj) {
      return res.status(404).json({ error: 'Classroom not found or unauthorized.' });
    }

    // Check if an active session already exists for this class
    const existingActive = await AttendanceSession.findOne({
      classId,
      status: 'active',
      expiresAt: { $gt: new Date() }
    });

    if (existingActive) {
      return res.json({ message: 'Session already active', session: existingActive });
    }

    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    const session = await AttendanceSession.create({
      classId,
      teacherId: req.user._id,
      mode,
      durationMinutes,
      expiresAt,
      status: 'active'
    });

    // Cache active session
    cache.set(`session:active:${session._id}`, session.toObject(), durationMinutes * 60 + 60);

    return res.status(201).json({ message: 'Attendance session started', session });
  } catch (err) {
    console.error('Start session error:', err);
    return res.status(500).json({ error: 'Failed to start attendance session' });
  }
}

/**
 * Teacher Ends Attendance Session
 */
async function endSession(req, res) {
  try {
    const { sessionId } = req.params;
    const session = await AttendanceSession.findOne({ _id: sessionId, teacherId: req.user._id });

    if (!session) {
      return res.status(404).json({ error: 'Session not found or unauthorized.' });
    }

    session.status = 'completed';
    await session.save();

    cache.del(`session:active:${sessionId}`);

    return res.json({ message: 'Attendance session ended successfully', session });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to end session' });
  }
}

/**
 * Projector View Token Stream Generator
 */
async function getProjectorToken(req, res) {
  try {
    const { sessionId } = req.params;

    const session = await AttendanceSession.findById(sessionId);
    if (!session || session.status !== 'active' || new Date() > session.expiresAt) {
      return res.status(400).json({ error: 'Session is no longer active or has expired.' });
    }

    const token = generateDynamicToken(sessionId);
    const expiresMs = 3000 - (Date.now() % 3000);

    return res.json({
      sessionId,
      token,
      expiresMs
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate projector token' });
  }
}

/**
 * Student Submits Attendance Verification Transaction
 */
async function verifyAttendance(req, res) {
  try {
    const { sessionId, token, authTxToken, location, faceVerified, requestId } = req.body;

    if (!sessionId || !token || !requestId) {
      return res.status(400).json({ error: 'Missing required parameters (sessionId, token, requestId).' });
    }

    // 1. Check Idempotency Cache
    const idempotencyKey = `idempotency:${requestId}`;
    const cachedResponse = cache.get(idempotencyKey);
    if (cachedResponse) {
      return res.json(cachedResponse);
    }

    // 2. Stage 1: HARD SECURITY GATES

    // Gate A: Check Session Active
    const session = await AttendanceSession.findById(sessionId).populate('classId');
    if (!session || session.status !== 'active' || new Date() > session.expiresAt) {
      return res.status(400).json({ error: 'Attendance session is inactive or expired.' });
    }

    // Gate B: Check Class Enrollment
    const enrollment = await ClassEnrollment.findOne({ classId: session.classId._id, studentId: req.user._id });
    if (!enrollment) {
      return res.status(403).json({ error: 'You are not enrolled in this classroom.' });
    }

    // Gate C: Check Dynamic Signed QR Token Validity
    const tokenResult = verifyDynamicToken(token);
    if (!tokenResult.valid) {
      return res.status(400).json({ error: `Verification failed: ${tokenResult.reason}` });
    }

    if (tokenResult.sessionId !== sessionId) {
      return res.status(400).json({ error: 'Token does not match the active classroom session.' });
    }

    // Gate D: Replay Protection Check
    const replayKey = `token:replay:${sessionId}:${tokenResult.nonce}`;
    if (cache.has(replayKey)) {
      return res.status(400).json({ error: 'Replay attack detected: Dynamic QR token has already been used.' });
    }

    // Gate E: WebAuthn Assertion Check
    let webauthnVerified = false;
    if (authTxToken) {
      try {
        const decoded = jwt.verify(authTxToken, config.JWT_SECRET);
        if (decoded.userId === req.user._id.toString() && decoded.userVerified) {
          webauthnVerified = true;
        }
      } catch (e) {
        webauthnVerified = false;
      }
    }

    // Gate F: Existing Attendance Record Check
    const existingRecord = await AttendanceRecord.findOne({ sessionId, studentId: req.user._id });
    if (existingRecord) {
      return res.status(400).json({ error: 'You have already submitted attendance for this session.' });
    }

    // 3. Stage 2: PHYSICAL & CONTEXTUAL EVIDENCE EVALUATION
    const evidenceReasons = [];
    let score = 50; // Base score for passing hard gates

    if (webauthnVerified) {
      score += 25;
      evidenceReasons.push('Cryptographic WebAuthn user verification passed (+25)');
    } else {
      evidenceReasons.push('Standard password session used (No WebAuthn passkey)');
    }

    // Evaluate Location
    let locEval = { confidence: 'none', score: 0, distanceMeters: null, reason: 'No location provided' };
    if (location && typeof location.latitude === 'number' && typeof location.longitude === 'number') {
      locEval = evaluateLocationConfidence(
        location.latitude,
        location.longitude,
        location.accuracy,
        session.classId.geofence
      );
    }

    if (locEval.confidence === 'high') {
      score += 25;
      evidenceReasons.push(locEval.reason + ' (+25)');
    } else if (locEval.confidence === 'medium') {
      score += 15;
      evidenceReasons.push(locEval.reason + ' (+15)');
    } else {
      evidenceReasons.push(locEval.reason + ' (+0)');
    }

    // Optional Face Verification
    if (session.mode === 'high_assurance' && faceVerified) {
      score += 15;
      evidenceReasons.push('Live active face verification passed (+15)');
    }

    const confidenceScore = Math.min(100, score);
    const finalStatus = confidenceScore >= 75 ? 'present' : 'suspicious';

    // 4. Save Record to Database (Handled with unique index fallback)
    let newRecord;
    try {
      newRecord = await AttendanceRecord.create({
        sessionId,
        classId: session.classId._id,
        studentId: req.user._id,
        status: finalStatus,
        confidenceScore,
        evidence: {
          tokenValid: true,
          webauthnVerified,
          locationConfidence: locEval.confidence,
          faceVerificationUsed: Boolean(faceVerified),
          reasons: evidenceReasons
        }
      });
    } catch (dbErr) {
      if (dbErr.code === 11000) {
        return res.status(400).json({ error: 'Attendance already recorded for this session.' });
      }
      throw dbErr;
    }

    // Mark token nonce as used in Redis/Cache
    cache.set(replayKey, { studentId: req.user._id, timestamp: Date.now() }, 300);

    const responseData = {
      message: finalStatus === 'present' ? 'ATTENDANCE MARKED PRESENT' : 'ATTENDANCE FLAGGED FOR REVIEW',
      status: finalStatus,
      confidenceScore,
      evidence: newRecord.evidence,
      timestamp: newRecord.timestamp
    };

    // Cache Idempotency Response (1 Hour)
    cache.set(idempotencyKey, responseData, 3600);

    return res.status(201).json(responseData);
  } catch (err) {
    console.error('Verify attendance error:', err);
    return res.status(500).json({ error: 'Failed to verify attendance submission' });
  }
}

/**
 * Get Live Session Attendance Status (Counts & Real-time Stream)
 */
async function getSessionLiveStatus(req, res) {
  try {
    const { sessionId } = req.params;

    const session = await AttendanceSession.findById(sessionId).populate('classId');
    if (!session) {
      return res.status(404).json({ error: 'Attendance session not found' });
    }

    // Get all enrolled students
    const enrollments = await ClassEnrollment.find({ classId: session.classId._id }).populate('studentId', 'name email collegeId');
    const totalEnrolled = enrollments.length;

    // Get all attendance records for this session
    const records = await AttendanceRecord.find({ sessionId }).populate('studentId', 'name collegeId');

    const recordMap = new Map();
    records.forEach(r => {
      recordMap.set(r.studentId._id.toString(), r);
    });

    let presentCount = 0;
    let suspiciousCount = 0;

    const studentStatuses = enrollments.map(e => {
      const rec = recordMap.get(e.studentId._id.toString());
      if (!rec) {
        return {
          studentId: e.studentId._id,
          name: e.studentId.name,
          collegeId: e.studentId.collegeId,
          rollNo: e.rollNo,
          status: 'absent',
          confidenceScore: 0,
          timestamp: null
        };
      }

      if (rec.status === 'present') presentCount++;
      if (rec.status === 'suspicious') suspiciousCount++;

      return {
        recordId: rec._id,
        studentId: e.studentId._id,
        name: e.studentId.name,
        collegeId: e.studentId.collegeId,
        rollNo: e.rollNo,
        status: rec.status,
        confidenceScore: rec.confidenceScore,
        evidence: rec.evidence,
        timestamp: rec.timestamp
      };
    });

    const absentCount = totalEnrolled - (presentCount + suspiciousCount);

    return res.json({
      session: {
        id: session._id,
        status: session.status,
        expiresAt: session.expiresAt,
        durationMinutes: session.durationMinutes,
        mode: session.mode
      },
      counts: {
        totalEnrolled,
        present: presentCount,
        suspicious: suspiciousCount,
        absent: Math.max(0, absentCount)
      },
      students: studentStatuses
    });
  } catch (err) {
    console.error('Live status error:', err);
    return res.status(500).json({ error: 'Failed to fetch session live status' });
  }
}

/**
 * Teacher Manual Override of Attendance Record Status with Audit Log
 */
async function overrideAttendance(req, res) {
  try {
    const { recordId } = req.params;
    const { newStatus, reason } = req.body;

    if (!['present', 'suspicious', 'absent'].includes(newStatus) || !reason) {
      return res.status(400).json({ error: 'New status (present/suspicious/absent) and explicit reason are required.' });
    }

    const record = await AttendanceRecord.findById(recordId);
    if (!record) {
      return res.status(404).json({ error: 'Attendance record not found.' });
    }

    const previousStatus = record.status;
    record.status = newStatus;
    await record.save();

    // Create Audit Log
    await AttendanceAuditLog.create({
      recordId: record._id,
      sessionId: record.sessionId,
      studentId: record.studentId,
      modifiedByTeacherId: req.user._id,
      action: 'TEACHER_OVERRIDE',
      previousStatus,
      newStatus,
      reason
    });

    return res.json({ message: `Status updated from ${previousStatus} to ${newStatus}`, record });
  } catch (err) {
    console.error('Override error:', err);
    return res.status(500).json({ error: 'Failed to override attendance record status' });
  }
}

module.exports = {
  startSession,
  endSession,
  getProjectorToken,
  verifyAttendance,
  getSessionLiveStatus,
  overrideAttendance
};
