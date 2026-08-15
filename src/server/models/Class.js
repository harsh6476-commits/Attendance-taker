const mongoose = require('mongoose');

const ClassSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    className: {
      type: String,
      required: true,
      trim: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    section: {
      type: String,
      required: true,
      trim: true
    },
    semester: {
      type: String,
      required: true,
      trim: true
    },
    classCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    geofence: {
      latitude: Number,
      longitude: Number,
      radiusMeters: { type: Number, default: 30 },
      sampleSpreadMeters: { type: Number, default: 5 }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Class', ClassSchema);
