// Builds a simple CSV (opens fine in Excel/Google Sheets) for a set of attendance records.
// Kept dependency-free on purpose so the project stays lightweight.

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function fmtTime(date) {
  return date ? new Date(date).toLocaleString() : '';
}

function fmtCoords(lat, lng) {
  if (lat === undefined || lng === undefined || lat === null || lng === null) return '';
  return `${lat}, ${lng}`;
}

function buildMonthlyReportCSV(records) {
  const headers = [
    'Employee Name',
    'Employee Email',
    'Employee ID',
    'Date',
    'Check-In Time',
    'Check-In Location (lat,lng)',
    'Check-Out Time',
    'Check-Out Location (lat,lng)',
    'Status',
  ];

  const rows = records.map((r) => [
    r.user?.name,
    r.user?.email,
    r.user?.employeeId,
    r.date,
    fmtTime(r.checkIn?.time),
    fmtCoords(r.checkIn?.latitude, r.checkIn?.longitude),
    fmtTime(r.checkOut?.time),
    fmtCoords(r.checkOut?.latitude, r.checkOut?.longitude),
    r.status,
  ]);

  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(','));
  return lines.join('\n');
}

module.exports = { buildMonthlyReportCSV };
