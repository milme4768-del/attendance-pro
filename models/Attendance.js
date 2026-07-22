const mongoose = require('mongoose');

const punchSchema = new mongoose.Schema(
  {
    time: { type: Date },
    image: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    accuracy: { type: Number },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
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

attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
