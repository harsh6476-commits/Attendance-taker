const mongoose = require('mongoose');

const AttendanceRecordSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AttendanceSession',
      required: true,
      index: true
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
      index: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['present', 'suspicious'],
      required: true
    },
    confidenceScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    evidence: {
      tokenValid: { type: Boolean, required: true },
      webauthnVerified: { type: Boolean, required: true },
      locationConfidence: { type: String, enum: ['high', 'medium', 'low', 'none'], default: 'none' },
      faceVerificationUsed: { type: Boolean, default: false },
      reasons: [{ type: String }]
    }
  },
  { timestamps: true }
);

// Database-level unicity constraint to prevent duplicate attendance submission races
AttendanceRecordSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceRecord', AttendanceRecordSchema);
