const crypto = require('crypto');
const Class = require('../models/Class');
const ClassEnrollment = require('../models/ClassEnrollment');
const User = require('../models/User');
const { computeLocationCenter } = require('../utils/haversine');

/**
 * Teacher Creates a Class
 */
async function createClass(req, res) {
  try {
    const { className, subject, section, semester, customClassCode } = req.body;

    if (!className || !subject || !section || !semester) {
      return res.status(400).json({ error: 'Class name, subject, section, and semester are required.' });
    }

    const classCode = customClassCode
      ? customClassCode.toUpperCase()
      : `${subject.substring(0, 3).toUpperCase()}-${section.toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const existingClass = await Class.findOne({ classCode });
    if (existingClass) {
      return res.status(400).json({ error: 'Class code already exists. Please choose a unique code.' });
    }

    const newClass = await Class.create({
      teacherId: req.user._id,
      className,
      subject,
      section,
      semester,
      classCode
    });

    return res.status(201).json({ message: 'Classroom created successfully', class: newClass });
  } catch (err) {
    console.error('Create class error:', err);
    return res.status(500).json({ error: 'Failed to create classroom' });
  }
}

/**
 * Teacher Enrolls Students in Class (Sequential Roll Range or Array list)
 */
async function enrollStudents(req, res) {
  try {
    const { classId } = req.params;
    const { method, startRoll, endRoll, rollPrefix, studentList } = req.body;

    const classObj = await Class.findOne({ _id: classId, teacherId: req.user._id });
    if (!classObj) {
      return res.status(404).json({ error: 'Classroom not found or unauthorized.' });
    }

    let enrolledCount = 0;
    const errors = [];

    if (method === 'sequential') {
      const start = parseInt(startRoll, 10);
      const end = parseInt(endRoll, 10);
      const prefix = rollPrefix || '';

      if (isNaN(start) || isNaN(end) || start > end) {
        return res.status(400).json({ error: 'Invalid sequential roll number range.' });
      }

      for (let roll = start; roll <= end; roll++) {
        const rollNoStr = `${prefix}${roll}`;
        const collegeIdStr = `ID-${rollNoStr}`;

        // Find or create student user account
        let student = await User.findOne({ collegeId: collegeIdStr });
        if (!student) {
          student = await User.create({
            role: 'student',
            name: `Student ${rollNoStr}`,
            email: `student.${rollNoStr.toLowerCase()}@college.edu`,
            collegeId: collegeIdStr,
            passwordHash: '$2a$12$e0MYzXyjpJS7Pd0RVvHwHeFz2WnLhJkK2qT.3l0iF0mH5l2G6g7eG' // default hashed password 'Student@123'
          });
        }

        try {
          await ClassEnrollment.create({
            classId: classObj._id,
            studentId: student._id,
            rollNo: rollNoStr
          });
          enrolledCount++;
        } catch (e) {
          // Ignore duplicate enrollment error
        }
      }
    } else if (method === 'manual' && Array.isArray(studentList)) {
      for (const item of studentList) {
        const { rollNo, email, collegeId, name } = item;
        if (!rollNo || !email || !collegeId) continue;

        let student = await User.findOne({ $or: [{ email: email.toLowerCase() }, { collegeId: collegeId.toUpperCase() }] });
        if (!student) {
          student = await User.create({
            role: 'student',
            name: name || `Student ${rollNo}`,
            email: email.toLowerCase(),
            collegeId: collegeId.toUpperCase(),
            passwordHash: '$2a$12$e0MYzXyjpJS7Pd0RVvHwHeFz2WnLhJkK2qT.3l0iF0mH5l2G6g7eG'
          });
        }

        try {
          await ClassEnrollment.create({
            classId: classObj._id,
            studentId: student._id,
            rollNo
          });
          enrolledCount++;
        } catch (e) {
          // Ignore duplicate enrollment
        }
      }
    } else {
      return res.status(400).json({ error: 'Invalid enrollment method specified.' });
    }

    return res.json({
      message: `Enrolled ${enrolledCount} students successfully`,
      enrolledCount
    });
  } catch (err) {
    console.error('Enroll students error:', err);
    return res.status(500).json({ error: 'Failed to enroll students' });
  }
}

/**
 * Student Joins Class via Class Code
 */
async function joinClass(req, res) {
  try {
    const { classCode, rollNo } = req.body;

    if (!classCode || !rollNo) {
      return res.status(400).json({ error: 'Class code and roll number are required.' });
    }

    const classObj = await Class.findOne({ classCode: classCode.toUpperCase() });
    if (!classObj) {
      return res.status(404).json({ error: 'Invalid class code. Classroom not found.' });
    }

    const existingEnrollment = await ClassEnrollment.findOne({
      classId: classObj._id,
      studentId: req.user._id
    });

    if (existingEnrollment) {
      return res.status(400).json({ error: 'You are already enrolled in this classroom.' });
    }

    await ClassEnrollment.create({
      classId: classObj._id,
      studentId: req.user._id,
      rollNo
    });

    return res.json({ message: `Successfully joined ${classObj.className}`, class: classObj });
  } catch (err) {
    console.error('Join class error:', err);
    return res.status(500).json({ error: 'Failed to join class' });
  }
}

/**
 * Get Classes Created by Teacher
 */
async function getTeacherClasses(req, res) {
  try {
    const classes = await Class.find({ teacherId: req.user._id }).sort({ createdAt: -1 });

    const classesWithStats = await Promise.all(
      classes.map(async c => {
        const studentCount = await ClassEnrollment.countDocuments({ classId: c._id });
        return {
          ...c.toObject(),
          studentCount
        };
      })
    );

    return res.json({ classes: classesWithStats });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch teacher classes' });
  }
}

/**
 * Get Classes Student is Enrolled in
 */
async function getStudentClasses(req, res) {
  try {
    const enrollments = await ClassEnrollment.find({ studentId: req.user._id }).populate('classId');
    const classes = enrollments.map(e => ({
      ...e.classId.toObject(),
      rollNo: e.rollNo,
      joinedAt: e.joinedAt
    }));

    return res.json({ classes });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch student classes' });
  }
}

/**
 * Get Class Details with Enrolled Student List
 */
async function getClassDetails(req, res) {
  try {
    const { classId } = req.params;
    const classObj = await Class.findById(classId).populate('teacherId', 'name email');
    if (!classObj) {
      return res.status(404).json({ error: 'Classroom not found' });
    }

    const enrollments = await ClassEnrollment.find({ classId }).populate('studentId', 'name email collegeId');
    const enrolledStudents = enrollments.map(e => ({
      enrollmentId: e._id,
      studentId: e.studentId._id,
      name: e.studentId.name,
      email: e.studentId.email,
      collegeId: e.studentId.collegeId,
      rollNo: e.rollNo
    }));

    return res.json({
      class: classObj,
      enrolledStudents
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch class details' });
  }
}

/**
 * Register Classroom Geofence using 5-Sample GPS Averaging
 */
async function registerGeofence(req, res) {
  try {
    const { classId } = req.params;
    const { locationSamples, radiusMeters } = req.body;

    const classObj = await Class.findOne({ _id: classId, teacherId: req.user._id });
    if (!classObj) {
      return res.status(404).json({ error: 'Classroom not found or unauthorized.' });
    }

    if (!Array.isArray(locationSamples) || locationSamples.length === 0) {
      return res.status(400).json({ error: 'At least one GPS location sample is required.' });
    }

    const center = computeLocationCenter(locationSamples);
    if (!center) {
      return res.status(400).json({ error: 'Failed to compute location center from samples.' });
    }

    classObj.geofence = {
      latitude: center.latitude,
      longitude: center.longitude,
      radiusMeters: radiusMeters || 30,
      sampleSpreadMeters: center.sampleSpreadMeters
    };

    await classObj.save();

    return res.json({
      message: 'Classroom geofence registered successfully',
      geofence: classObj.geofence
    });
  } catch (err) {
    console.error('Register geofence error:', err);
    return res.status(500).json({ error: 'Failed to register geofence' });
  }
}

module.exports = {
  createClass,
  enrollStudents,
  joinClass,
  getTeacherClasses,
  getStudentClasses,
  getClassDetails,
  registerGeofence
};
