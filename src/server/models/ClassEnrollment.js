const mongoose = require('mongoose');

const ClassEnrollmentSchema = new mongoose.Schema(
  {
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
    rollNo: {
      type: String,
      required: true,
      trim: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

ClassEnrollmentSchema.index({ classId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('ClassEnrollment', ClassEnrollmentSchema);
