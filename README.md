# ShiftLog — Attendance Tracker (Node.js + Express + MongoDB)

Remote staff check in and check out with a selfie photo + GPS location. Admins create
staff logins, watch attendance come in live, and download monthly CSV reports.

## What's included

- **No public sign-up.** Only an admin can create staff logins (as you asked for).
- **Staff dashboard**: big punch-clock UI, front-camera photo capture, GPS location tagging,
  one check-in and one check-out per day, and a personal history table.
- **Admin dashboard**: live logs (auto-refreshes every 10s), filter by date/staff member,
  view each check-in/out photo and map link for the GPS coordinates, create/disable staff
  accounts, and download a monthly CSV report (opens in Excel/Google Sheets).
- **Backend**: Express REST API, MongoDB via Mongoose, JWT auth, bcrypt password hashing,
  Multer for photo uploads.
- Plain HTML/CSS/JS frontend — no build step, loads instantly, works well on phones.

## Project structure

```
attendance-tracker/
  server.js               Express app entrypoint
  config/db.js             MongoDB connection
  models/User.js           Admin + staff accounts
  models/Attendance.js     One record per user per day (checkIn/checkOut)
  middleware/auth.js        JWT verification + admin guard
  middleware/upload.js      Multer photo storage (uploads/<userId>/...)
  routes/authRoutes.js      POST /api/auth/login, GET /api/auth/me
  routes/attendanceRoutes.js  Staff check-in/out + own history
  routes/adminRoutes.js     Manage staff, live logs, monthly CSV report
  utils/generateReport.js   CSV builder
  seed/createAdmin.js       Creates the first admin account from .env
  public/                  Frontend (login, staff dashboard, admin dashboard)
  uploads/                 Check-in/out photos land here (gitignored)
```

## Setup

**Requirements:** Node.js 18+, and a MongoDB database (local install or a free
[MongoDB Atlas](https://www.mongodb.com/atlas) cluster).

```bash
cd attendance-tracker
npm install
cp .env.example .env
```

Edit `.env`:

```
MONGO_URI=mongodb://127.0.0.1:27017/attendance_tracker   # or your Atlas URI
JWT_SECRET=some-long-random-string
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=pick-a-strong-password
```

Create the first admin account:

```bash
npm run seed:admin
```

Start the app:

```bash
npm start          # production
npm run dev         # auto-restart on changes (nodemon)
```

Visit `http://localhost:5000/login.html`, sign in with the admin credentials from `.env`,
then use the **Staff Accounts** tab to create logins for each remote worker.

## How the daily flow works

1. Admin creates a staff account (name, email, temp password, employee ID, department).
2. Staff member opens the app on their phone, signs in, taps **Check In**.
3. The browser asks for camera + location permission, staff takes a selfie, and the shift
   starts — timestamp, photo, and GPS coordinates are saved together.
4. At the end of the shift, staff taps **Check Out** and repeats the photo + location step.
5. Admin sees the entry appear in **Live Logs** within 10 seconds, can click through to the
   photo or open the GPS point on Google Maps.
6. At month end, admin goes to **Monthly Reports**, picks the month, and downloads a CSV
   with every check-in/out, timestamp, and coordinates for payroll/HR records.

## Notes for production use

- Put the app behind HTTPS — camera and geolocation APIs require it on real domains.
- The `/uploads` static folder is currently open to anyone with the URL. For production,
  move photos to private cloud storage (S3, GCS) with signed URLs, or add an auth check
  in front of `/uploads`.
- Rotate `JWT_SECRET` and the seeded admin password immediately after first login.
- Consider adding rate limiting (e.g. `express-rate-limit`) on `/api/auth/login`.
- MongoDB enforces one attendance record per user per day, so a staff member can't
  double check-in — the API returns a clear error if they try.
