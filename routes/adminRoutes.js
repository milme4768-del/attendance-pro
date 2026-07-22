const express = require('express');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const { protect, adminOnly } = require('../middleware/auth');
const { buildMonthlyReportCSV } = require('../utils/generateReport');

const router = express.Router();

router.use(protect, adminOnly);

router.post('/users', async (req, res) => {
  try {
    const { name, email, password, employeeId, department, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'A user with that email already exists' });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      employeeId,
      department,
      role: role === 'admin' ? 'admin' : 'staff',
    });

    res.status(201).json({ message: 'User created', user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const { name, employeeId, department, isActive, password } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name !== undefined) user.name = name;
    if (employeeId !== undefined) user.employeeId = employeeId;
    if (department !== undefined) user.department = department;
    if (isActive !== undefined) user.isActive = isActive;
    if (password) user.password = password;

    await user.save();
    res.json({ message: 'User updated', user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const filter = {};
    if (req.query.date) filter.date = req.query.date;
    if (req.query.userId) filter.user = req.query.userId;

    const logs = await Attendance.find(filter)
      .populate('user', 'name email employeeId department')
      .sort({ updatedAt: -1 })
      .limit(200);

    res.json({ logs });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/reports/monthly', async (req, res) => {
  try {
    const month = parseInt(req.query.month, 10);
    const year = parseInt(req.query.year, 10);
    if (!month || !year) {
      return res.status(400).json({ message: 'month and year query params are required' });
    }

    const mm = String(month).padStart(2, '0');
    const prefix = `${year}-${mm}`;

    const records = await Attendance.find({ date: { $regex: `^${prefix}` } })
      .populate('user', 'name email employeeId')
      .sort({ date: 1 });

    const csv = buildMonthlyReportCSV(records);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="attendance-report-${prefix}.csv"`
    );
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
