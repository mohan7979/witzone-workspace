const { Op }   = require('sequelize');
const moment   = require('moment');
const { Attendance, User, IdleLog, Leave } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

exports.clockIn = asyncHandler(async (req, res) => {
  const today = moment().format('YYYY-MM-DD');
  const existing = await Attendance.findOne({ where: { user_id: req.user.id, date: today } });

  if (existing?.login_time)
    return res.status(400).json({ message: 'Already clocked in today' });

  const record = existing
    ? await existing.update({ login_time: new Date(), status: 'present', login_ip: req.ip })
    : await Attendance.create({
        user_id: req.user.id, date: today,
        login_time: new Date(), status: 'present', login_ip: req.ip,
      });

  res.json({ message: 'Clocked in successfully', attendance: record });
});

exports.clockOut = asyncHandler(async (req, res) => {
  const today = moment().format('YYYY-MM-DD');
  const record = await Attendance.findOne({ where: { user_id: req.user.id, date: today } });

  if (!record?.login_time)
    return res.status(400).json({ message: 'No clock-in found for today' });
  if (record.logout_time)
    return res.status(400).json({ message: 'Already clocked out today' });

  const logoutTime  = new Date();
  const totalHours  = parseFloat(((logoutTime - record.login_time) / 3600000).toFixed(2));
  const status      = totalHours < 4.5 ? 'half_day' : 'present';

  // Close any open idle session at clock-out time
  await IdleLog.update(
    { idle_end: logoutTime },
    { where: { user_id: req.user.id, date: today, idle_end: null } }
  );

  // Sum completed idle sessions for the day
  const idleLogs    = await IdleLog.findAll({ where: { user_id: req.user.id, date: today } });
  const idleSeconds = idleLogs.reduce((sum, l) => sum + (l.idle_seconds || 0), 0);
  const effectiveHours = parseFloat(Math.max(0, totalHours - idleSeconds / 3600).toFixed(2));

  await record.update({
    logout_time: logoutTime, total_hours: totalHours,
    status, logout_ip: req.ip,
    idle_seconds: idleSeconds, effective_hours: effectiveHours,
  });
  res.json({ message: 'Clocked out successfully', attendance: record });
});

exports.todayStatus = asyncHandler(async (req, res) => {
  const today = moment().format('YYYY-MM-DD');
  const record = await Attendance.findOne({ where: { user_id: req.user.id, date: today } });
  res.json({ attendance: record || null });
});

exports.myHistory = asyncHandler(async (req, res) => {
  const { start, end, page = 1, limit = 31 } = req.query;
  const where = { user_id: req.user.id };
  if (start && end) where.date = { [Op.between]: [start, end] };

  const { count, rows } = await Attendance.findAndCountAll({
    where,
    order: [['date', 'DESC']],
    limit:  parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
  });
  res.json({ total: count, data: rows });
});

exports.teamAttendance = asyncHandler(async (req, res) => {
  const { date, department, page = 1, limit = 200 } = req.query;
  const today = date || moment().format('YYYY-MM-DD');

  // Weekend check — Sat (6) and Sun (0) are non-working days
  const dayOfWeek = moment(today).day();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return res.json({ date: today, total: 0, data: [], weekend: true });
  }

  const userWhere = { status: 'active' };
  if (department) userWhere.department = department;
  if (req.user.role === 'lead') userWhere.manager_id = req.user.id;

  // Fetch all active employees + their attendance record for the day (LEFT JOIN equivalent)
  const [employees, records] = await Promise.all([
    User.findAll({
      where: userWhere,
      attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department', 'designation'],
      order: [['first_name', 'ASC']],
    }),
    Attendance.findAll({
      where: { date: today },
      include: [{
        model: User, as: 'user', where: userWhere,
        attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department', 'designation'],
      }],
    }),
  ]);

  // Build a map for quick lookup
  const recordByUserId = {};
  for (const r of records) {
    if (r.user?.id) recordByUserId[r.user.id] = r;
  }

  // Merge: every employee gets a row — absent if no record found
  const rows = employees.map((emp) => {
    const rec = recordByUserId[emp.id];
    if (rec) return rec;
    // Synthesise an "absent" row for employees with no record
    return {
      id: null,
      user_id: emp.id,
      date: today,
      login_time: null,
      logout_time: null,
      total_hours: null,
      effective_hours: null,
      idle_seconds: null,
      status: 'absent',
      user: emp,
    };
  });

  const lim    = parseInt(limit);
  const offset = (parseInt(page) - 1) * lim;
  const paged  = rows.slice(offset, offset + lim);

  res.json({ date: today, total: rows.length, data: paged });
});

// ---------------------------------------------------------------------------
// Calendar view — returns a per-day status map for a given month
// Merges attendance records + leave records into a single colour-coded map.
// ---------------------------------------------------------------------------
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function hoursDetail(att) {
  const hrs  = parseFloat(att.total_hours     || 0).toFixed(1);
  const eff  = parseFloat(att.effective_hours || 0).toFixed(1);
  const idle = att.idle_seconds ? `${Math.round(att.idle_seconds / 60)}m idle` : '';
  return [`${hrs}h worked`, eff !== hrs ? `${eff}h effective` : null, idle || null]
    .filter(Boolean).join(' · ');
}

exports.calendarView = asyncHandler(async (req, res) => {
  const y = parseInt(req.query.year)  || moment().year();
  const m = parseInt(req.query.month) || (moment().month() + 1);

  const startStr = moment(`${y}-${String(m).padStart(2, '0')}-01`).format('YYYY-MM-DD');
  const endStr   = moment(startStr).endOf('month').format('YYYY-MM-DD');
  const today    = moment().format('YYYY-MM-DD');
  const userId   = req.user.id;

  const [attendances, leaves] = await Promise.all([
    Attendance.findAll({
      where: { user_id: userId, date: { [Op.between]: [startStr, endStr] } },
      raw: true,
    }),
    Leave.findAll({
      where: {
        user_id:    userId,
        status:     { [Op.in]: ['pending', 'approved'] },
        start_date: { [Op.lte]: endStr },
        end_date:   { [Op.gte]: startStr },
      },
      raw: true,
    }),
  ]);

  // Build lookup maps
  const attMap = {};
  for (const a of attendances) attMap[a.date] = a;

  const leaveMap = {};
  for (const lv of leaves) {
    let cur = moment(lv.start_date);
    const lvEnd = moment(lv.end_date);
    while (cur.isSameOrBefore(lvEnd)) {
      const d = cur.format('YYYY-MM-DD');
      if (d >= startStr && d <= endStr) leaveMap[d] = lv;
      cur.add(1, 'day');
    }
  }

  // Build per-day entries
  const days = {};
  let cur = moment(startStr);

  while (cur.isSameOrBefore(moment(endStr))) {
    const d         = cur.format('YYYY-MM-DD');
    const att       = attMap[d];
    const lv        = leaveMap[d];
    const isFuture  = d > today;
    const isWeekend = cur.day() === 0 || cur.day() === 6;

    let entry = null;

    if (att) {
      if (att.status === 'holiday') {
        entry = { type: 'holiday',  label: 'Holiday',  detail: att.notes || 'Public Holiday' };

      } else if (att.status === 'on_leave') {
        const lvLabel = lv ? `${capitalize(lv.type.replace(/_/g, ' '))} Leave` : 'On Leave';
        entry = { type: 'leave', label: lvLabel, detail: lv?.reason || '', leave_status: lv?.status };

      } else if (att.status === 'present') {
        entry = {
          type: 'present', label: 'Present',
          detail: hoursDetail(att),
          login_time: att.login_time, logout_time: att.logout_time,
        };

      } else if (att.status === 'half_day') {
        entry = { type: 'half_day', label: 'Half Day', detail: hoursDetail(att) };

      } else if (att.status === 'absent') {
        entry = { type: 'absent', label: 'Absent', detail: '' };
      }

    } else if (lv) {
      const lvLabel = `${capitalize(lv.type.replace(/_/g, ' '))} Leave`;
      const pending = lv.status === 'pending';
      entry = {
        type:         isFuture ? 'leave_upcoming' : 'leave',
        label:        pending ? `${lvLabel} (Pending)` : lvLabel,
        detail:       lv.reason,
        leave_status: lv.status,
      };

    } else if (!isFuture && !isWeekend) {
      // Past weekday with no record
      entry = { type: 'absent', label: 'Absent', detail: 'No clock-in recorded' };
    }

    if (entry) days[d] = entry;
    cur.add(1, 'day');
  }

  // Summary counts
  const vals = Object.values(days);
  const summary = {
    present:  vals.filter(e => e.type === 'present').length,
    half_day: vals.filter(e => e.type === 'half_day').length,
    absent:   vals.filter(e => e.type === 'absent').length,
    leave:    vals.filter(e => e.type === 'leave' || e.type === 'leave_upcoming').length,
    holiday:  vals.filter(e => e.type === 'holiday').length,
  };

  res.json({ year: y, month: m, days, summary });
});
