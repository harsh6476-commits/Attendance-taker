const XLSX = require('xlsx');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const Class = require('../models/Class');
const ClassEnrollment = require('../models/ClassEnrollment');

/**
 * Export Daily/Session Attendance Matrix to Excel (.xlsx)
 */
async function exportClassSessionExcel(req, res) {
  try {
    const { sessionId } = req.params;

    const session = await AttendanceSession.findById(sessionId).populate('classId');
    if (!session) {
      return res.status(404).json({ error: 'Attendance session not found.' });
    }

    const classObj = session.classId;
    const enrollments = await ClassEnrollment.find({ classId: classObj._id }).populate('studentId', 'name collegeId email');
    const records = await AttendanceRecord.find({ sessionId }).populate('studentId', 'name collegeId');

    const recordMap = new Map();
    records.forEach(r => recordMap.set(r.studentId._id.toString(), r));

    const rows = enrollments.map(e => {
      const rec = recordMap.get(e.studentId._id.toString());
      const dateStr = session.startedAt ? new Date(session.startedAt).toLocaleDateString() : 'N/A';
      const timeStr = rec ? new Date(rec.timestamp).toLocaleTimeString() : '-';

      return {
        'Roll No': e.rollNo,
        'Student Name': e.studentId.name,
        'College ID': e.studentId.collegeId,
        'Class Name': `${classObj.className} (${classObj.section})`,
        Date: dateStr,
        Time: timeStr,
        Status: rec ? rec.status.toUpperCase() : 'ABSENT',
        'Confidence Score': rec ? `${rec.confidenceScore}%` : 'N/A',
        Evidence: rec && rec.evidence ? rec.evidence.reasons.join('; ') : 'No submission'
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 10 },
      { wch: 25 },
      { wch: 15 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 45 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Report');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const filename = `Attendance_${classObj.classCode}_${new Date(session.startedAt).toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    console.error('Export session excel error:', err);
    return res.status(500).json({ error: 'Failed to export attendance session to Excel' });
  }
}

/**
 * Export Cumulative Student Attendance Matrix across all sessions
 */
async function exportClassCumulativeExcel(req, res) {
  try {
    const { classId } = req.params;

    const classObj = await Class.findById(classId);
    if (!classObj) {
      return res.status(404).json({ error: 'Classroom not found.' });
    }

    const sessions = await AttendanceSession.find({ classId });
    const totalSessions = sessions.length;
    const sessionIds = sessions.map(s => s._id);

    const enrollments = await ClassEnrollment.find({ classId }).populate('studentId', 'name collegeId email');
    const records = await AttendanceRecord.find({ sessionId: { $in: sessionIds } });

    // Count present records per student
    const studentPresentCounts = new Map();
    records.forEach(r => {
      if (r.status === 'present') {
        const sId = r.studentId.toString();
        studentPresentCounts.set(sId, (studentPresentCounts.get(sId) || 0) + 1);
      }
    });

    const rows = enrollments.map(e => {
      const sId = e.studentId._id.toString();
      const presentCount = studentPresentCounts.get(sId) || 0;
      const absentCount = Math.max(0, totalSessions - presentCount);
      const percentage = totalSessions > 0 ? ((presentCount / totalSessions) * 100).toFixed(2) : '0.00';

      return {
        'Roll No': e.rollNo,
        'Student Name': e.studentId.name,
        'College ID': e.studentId.collegeId,
        'Classes Conducted': totalSessions,
        Present: presentCount,
        Absent: absentCount,
        'Attendance Percentage': `${percentage}%`
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 10 },
      { wch: 25 },
      { wch: 15 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 22 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cumulative Attendance');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Cumulative_Attendance_${classObj.classCode}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    console.error('Export cumulative excel error:', err);
    return res.status(500).json({ error: 'Failed to export cumulative attendance to Excel' });
  }
}

module.exports = {
  exportClassSessionExcel,
  exportClassCumulativeExcel
};
