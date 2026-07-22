const mongoose = require('mongoose');

const punchSchema = new mongoose.Schema(
  {
    time: { type: Date },
    image: { type: String }, // relative path under /uploads
    latitude: { type: Number },
    longitude: { type: Number },
    accuracy: { type: Number }, // meters, from browser geolocation
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD, one record per user per day
    checkIn: punchSchema,
    checkOut: punchSchema,
    status: {
      type: String,
      enum: ['checked-in', 'completed'],
      default: 'checked-in',
    },
  },
  { timestamps: true }
);

// prevents duplicate attendance rows for same user/day
attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
