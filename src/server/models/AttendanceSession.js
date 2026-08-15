const mongoose = require('mongoose');

const AttendanceSessionSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
      index: true
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    mode: {
      type: String,
      enum: ['fast', 'high_assurance'],
      default: 'fast'
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active'
    },
    durationMinutes: {
      type: Number,
      default: 5
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AttendanceSession', AttendanceSessionSchema);
