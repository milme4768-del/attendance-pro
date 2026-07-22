const express = require('express');
const path = require('path');
const Attendance = require('../models/Attendance');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

router.get('/today', protect, async (req, res) => {
  try {
    const record = await Attendance.findOne({ user: req.user.id, date: todayStr() });
    res.json({ record: record || null });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.get('/history', protect, async (req, res) => {
  try {
    const records = await Attendance.find({ user: req.user.id }).sort({ date: -1 }).limit(90);
    res.json({ records });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/checkin', protect, upload.single('image'), async (req, res) => {
  try {
    const { latitude, longitude, accuracy } = req.body;
    if (!req.file) return res.status(400).json({ message: 'Check-in photo is required' });
    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Location is required for check-in' });
    }

    const date = todayStr();
    const existing = await Attendance.findOne({ user: req.user.id, date });
    if (existing) {
      return res.status(400).json({ message: 'You have already checked in today' });
    }

    const record = await Attendance.create({
      user: req.user.id,
      date,
      checkIn: {
        time: new Date(),
        image: path.join(String(req.user.id), req.file.filename),
        latitude: Number(latitude),
        longitude: Number(longitude),
        accuracy: accuracy ? Number(accuracy) : undefined,
      },
      status: 'checked-in',
    });

    res.status(201).json({ message: 'Checked in successfully', record });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'You have already checked in today' });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.post('/checkout', protect, upload.single('image'), async (req, res) => {
  try {
    const { latitude, longitude, accuracy } = req.body;
    if (!req.file) return res.status(400).json({ message: 'Check-out photo is required' });
    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Location is required for check-out' });
    }

    const date = todayStr();
    const record = await Attendance.findOne({ user: req.user.id, date });

    if (!record) {
      return res.status(400).json({ message: 'You must check in before checking out' });
    }
    if (record.status === 'completed') {
      return res.status(400).json({ message: 'You have already checked out today' });
    }

    record.checkOut = {
      time: new Date(),
      image: path.join(String(req.user.id), req.file.filename),
      latitude: Number(latitude),
      longitude: Number(longitude),
      accuracy: accuracy ? Number(accuracy) : undefined,
    };
    record.status = 'completed';
    await record.save();

    res.json({ message: 'Checked out successfully. Shift complete!', record });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
