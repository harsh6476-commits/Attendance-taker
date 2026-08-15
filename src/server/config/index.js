const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_attendance_db',
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_jwt_key_smart_attendance_2026_prod',
  MASTER_HMAC_SECRET: process.env.MASTER_HMAC_SECRET || 'master_hmac_secret_key_smart_attendance_2026_super_secure',
  RP_ID: process.env.RP_ID || 'localhost',
  RP_NAME: 'Smart Classroom Attendance System',
  ORIGIN: process.env.ORIGIN || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development'
};
