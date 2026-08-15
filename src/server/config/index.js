const path = require('path');
const dotenv = require('dotenv');

// Load .env from working directory or project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGO_URI ,
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_jwt_key_smart_attendance_2026_prod',
  MASTER_HMAC_SECRET: process.env.MASTER_HMAC_SECRET || 'master_hmac_secret_key_smart_attendance_2026_super_secure',
  RP_ID: process.env.RP_ID || 'localhost',
  RP_NAME: 'Smart Classroom Attendance System',
  ORIGIN: process.env.ORIGIN || 'http://localhost:5173',
  NODE_ENV: process.env.NODE_ENV || 'development'
};

