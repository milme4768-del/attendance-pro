require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');

const authRoutes = require('./routes/authRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// ─── Auto-seed admin on first run ───────────────────────────────────────
async function seedAdmin() {
  try {
    const email = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
    const existing = await User.findOne({ email });
    if (!existing) {
      await User.create({
        name: process.env.ADMIN_NAME || 'Super Admin',
        email,
        password: process.env.ADMIN_PASSWORD || 'Admin@12345',
        role: 'admin',
      });
      console.log('✅ Admin account created automatically');
      console.log(`   Email: ${email}`);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'Admin@12345'}`);
      }
    } else {
      console.log('✅ Admin account already exists');
    }
  } catch (err) {
    console.error('⚠️  AUTO-SEED FAILED — admin account may not exist. Error:', err.message);
  }
}

// ─── Startup ────────────────────────────────────────────────────────────
async function start() {
  await connectDB();
  await seedAdmin();

  let server;
  async function shutdown() {
    console.log('\n🛑 Shutting down gracefully...');
    const forceExit = setTimeout(() => {
      console.error('Forced exit after timeout');
      process.exit(1);
    }, 8000);
    forceExit.unref();
    try {
      if (server) {
        await new Promise((resolve) => server.close(resolve));
        console.log('HTTP server closed');
      }
      await mongoose.disconnect();
      console.log('MongoDB disconnected');
    } catch (err) {
      console.error('Shutdown error:', err);
    }
    clearTimeout(forceExit);
    process.exit(0);
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : undefined;

  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
  app.use(express.static(path.join(__dirname, 'public')));

  app.use('/api/auth', authRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/admin', adminRoutes);

  app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
  });

  app.use((err, req, res, _next) => {
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({
      message: err.message || 'Server error',
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
  });

  const PORT = process.env.PORT || 5000;
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📋 Login page: http://localhost:${PORT}/login.html`);
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
