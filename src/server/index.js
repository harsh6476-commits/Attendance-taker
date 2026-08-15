const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');

const config = require('./config');
const authRoutes = require('./routes/authRoutes');
const classRoutes = require('./routes/classRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: false // Disabled for local dev flexibility with camera & inline styles
}));

app.use(cors({
  origin: [config.ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/reports', reportRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'Smart Classroom Attendance API Engine'
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error. Please try again later.' });
});

// Serve Static Compiled Frontend in Single-Server Mode
const fs = require('fs');
const distPath = path.join(__dirname, '../../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Database Connection & Server Initialization
mongoose
  .connect(config.MONGO_URI)
  .then(() => {
    console.log('[Database] MongoDB connected successfully ');
    app.listen(config.PORT, () => {
      console.log(`[Server] Smart Attendance Server running on port ${config.PORT}`);
    });
  })
  .catch(err => {
    console.error('[Database] MongoDB Connection Failure:', err);
    process.exit(1);
  });

module.exports = app;
