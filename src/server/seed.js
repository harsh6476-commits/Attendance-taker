const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('./config');
const User = require('./models/User');
const Class = require('./models/Class');
const ClassEnrollment = require('./models/ClassEnrollment');

async function seed() {
  try {
    await mongoose.connect(config.MONGO_URI);
    console.log('[Seed] Connected to MongoDB database...');

    // Clear existing collections
    await User.deleteMany({});
    await Class.deleteMany({});
    await ClassEnrollment.deleteMany({});

    console.log('[Seed] Cleared existing demo data.');

    const defaultPasswordHash = await bcrypt.hash('Teacher@123', 12);
    const studentPasswordHash = await bcrypt.hash('Student@123', 12);

    // 1. Create Teacher
    const teacher = await User.create({
      role: 'teacher',
      name: 'Dr. Rajesh Sharma',
      email: 'teacher.sharma@college.edu',
      collegeId: 'T-1049',
      passwordHash: defaultPasswordHash
    });

    console.log(`[Seed] Created Teacher: ${teacher.name} (${teacher.email})`);

    // 2. Create Demo Classroom
    const demoClass = await Class.create({
      teacherId: teacher._id,
      className: 'Data Structures & Algorithms',
      subject: 'DSA',
      section: 'A',
      semester: '3',
      classCode: 'DSA-A-2026',
      geofence: {
        latitude: 28.6139,
        longitude: 77.2090,
        radiusMeters: 30,
        sampleSpreadMeters: 4.5
      }
    });

    console.log(`[Seed] Created Classroom: ${demoClass.className} (Code: ${demoClass.classCode})`);

    // 3. Create 10 Demo Enrolled Students
    const studentPromises = [];
    for (let roll = 101; roll <= 110; roll++) {
      const rollStr = `${roll}`;
      const name = roll === 101 ? 'Rahul Kumar' : roll === 102 ? 'Arjun Verma' : roll === 103 ? 'Priya Singh' : `Student ${rollStr}`;
      const email = `student.${rollStr}@college.edu`;
      const collegeId = `ID-${rollStr}`;

      studentPromises.push(
        User.create({
          role: 'student',
          name,
          email,
          collegeId,
          passwordHash: studentPasswordHash
        }).then(student => {
          return ClassEnrollment.create({
            classId: demoClass._id,
            studentId: student._id,
            rollNo: rollStr
          });
        })
      );
    }

    await Promise.all(studentPromises);
    console.log('[Seed] Successfully enrolled 10 demo students in Data Structures Sec A.');

    console.log('\n==================================================');
    console.log('DEMO CREDENTIALS:');
    console.log('Teacher Login: teacher.sharma@college.edu / Teacher@123');
    console.log('Student Login: student.101@college.edu / Student@123');
    console.log('Classroom Code: DSA-A-2026');
    console.log('==================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('[Seed] Error during seeding:', err);
    process.exit(1);
  }
}

seed();
