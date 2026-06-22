const { Op, fn, col, literal } = require('sequelize');
const moment = require('moment');
const mtz = require('moment-timezone');
const ExcelJS = require('exceljs');
const { Attendance, Leave, IdleLog, User } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { todayIST, nowIST, TZ } = require('../utils/ist');

// ── idle-report formatting + Excel export helpers ─────────────────────────────
const _hms = (secs) => {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
};
const _hrsHms = (hours) => (hours == null ? '—' : _hms(Number(hours) * 3600));   // decimal hours → HH:MM:SS
const _clock  = (d) => (d ? mtz.tz(d, TZ).format('hh:mm A') : '—');
const _day    = (d) => (d ? mtz.tz(d, TZ).format('DD-MMM-YYYY') : '—');

async function sendIdleHistoryXlsx(res, { period, startDate, endDate, data, daily }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Witzone HRMS';

  // Sheet 1 — per-employee summary over the whole period
  const sum = wb.addWorksheet('Summary');
  sum.columns = [
    { header: 'Employee ID', key: 'eid', width: 12 },
    { header: 'Employee', key: 'name', width: 24 },
    { header: 'Department', key: 'dept', width: 16 },
    { header: 'Present Days', key: 'days', width: 13 },
    { header: 'Work Time', key: 'work', width: 13 },
    { header: 'Idle Time', key: 'idle', width: 13 },
    { header: 'Break Time', key: 'brk', width: 13 },
    { header: 'Effective Time', key: 'eff', width: 14 },
    { header: 'Idle Events', key: 'ev', width: 12 },
    { header: 'Long Idle (>=30m)', key: 'long', width: 16 },
  ];
  for (const r of data) sum.addRow({
    eid: r.user.employee_id, name: `${r.user.first_name} ${r.user.last_name}`, dept: r.user.department || '',
    days: r.present_days, work: _hrsHms(r.work_hours), idle: _hms(r.idle_seconds),
    brk: _hms(r.break_seconds), eff: _hrsHms(r.effective_hours), ev: r.idle_events, long: r.long_idle,
  });

  // Sheet 2 — day-by-day idle / working timeline per employee
  const tl = wb.addWorksheet('Daily Timeline');
  tl.columns = [
    { header: 'Date', key: 'date', width: 13 },
    { header: 'Employee ID', key: 'eid', width: 12 },
    { header: 'Employee', key: 'name', width: 24 },
    { header: 'Department', key: 'dept', width: 16 },
    { header: 'Clock In', key: 'in', width: 11 },
    { header: 'Clock Out', key: 'out', width: 11 },
    { header: '2nd In', key: 'in2', width: 11 },
    { header: '2nd Out', key: 'out2', width: 11 },
    { header: 'Work Time', key: 'work', width: 12 },
    { header: 'Idle Time', key: 'idle', width: 12 },
    { header: 'Break Time', key: 'brk', width: 12 },
    { header: 'Effective Time', key: 'eff', width: 13 },
    { header: 'Status', key: 'status', width: 11 },
  ];
  const sorted = daily.slice().sort((a, b) => {
    const an = `${a.user?.first_name} ${a.user?.last_name}`, bn = `${b.user?.first_name} ${b.user?.last_name}`;
    return an === bn ? String(a.date).localeCompare(String(b.date)) : an.localeCompare(bn);
  });
  for (const a of sorted) tl.addRow({
    date: _day(a.date), eid: a.user?.employee_id || '',
    name: `${a.user?.first_name || ''} ${a.user?.last_name || ''}`.trim(), dept: a.user?.department || '',
    in: _clock(a.login_time), out: _clock(a.logout_time), in2: _clock(a.login_time_2), out2: _clock(a.logout_time_2),
    work: _hrsHms(a.total_hours), idle: _hms(a.idle_seconds), brk: _hms(a.total_break_seconds),
    eff: _hrsHms(a.effective_hours), status: a.status,
  });

  for (const ws of [sum, tl]) {
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };
    ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + ws.columns.length)}1` };
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="idle-report-${period}-${startDate}_to_${endDate}.xlsx"`);
  res.send(Buffer.from(await wb.xlsx.writeBuffer()));
}

const buildUserWhere = (req, extra = {}) => {
  const where = { status: 'active', ...extra };
  if (req.user.role === 'lead') where.manager_id = req.user.id;
  return where;
};

exports.attendanceSummary = asyncHandler(async (req, res) => {
  const { start, end, department, user_id } = req.query;
  const startDate = start || moment().startOf('month').format('YYYY-MM-DD');
  const endDate   = end   || moment().endOf('month').format('YYYY-MM-DD');

  const userWhere = buildUserWhere(req);
  if (department) userWhere.department = department;
  if (user_id)    userWhere.id = user_id;

  const data = await Attendance.findAll({
    where: { date: { [Op.between]: [startDate, endDate] } },
    include: [{
      model: User, as: 'user', where: userWhere,
      attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department'],
    }],
    attributes: [
      'user_id',
      [fn('SUM', literal("CASE WHEN `Attendance`.`status`='present'  THEN 1 ELSE 0 END")), 'present_days'],
      [fn('SUM', literal("CASE WHEN `Attendance`.`status`='absent'   THEN 1 ELSE 0 END")), 'absent_days'],
      [fn('SUM', literal("CASE WHEN `Attendance`.`status`='half_day' THEN 1 ELSE 0 END")), 'half_days'],
      [fn('SUM', literal("CASE WHEN `Attendance`.`status`='on_leave' THEN 1 ELSE 0 END")), 'leave_days'],
      [fn('SUM', literal("COALESCE(`Attendance`.`total_hours`, 0)")),     'total_hours'],
      [fn('SUM', literal("COALESCE(`Attendance`.`effective_hours`, 0)")), 'effective_hours'],
      [fn('SUM', literal("COALESCE(`Attendance`.`idle_seconds`, 0)")),    'total_idle_seconds'],
    ],
    // All user attributes selected via include must be in GROUP BY to satisfy ONLY_FULL_GROUP_BY
    group: ['user_id', 'user.id', 'user.employee_id', 'user.first_name', 'user.last_name', 'user.department'],
  });

  res.json({ start: startDate, end: endDate, data });
});

exports.leaveReport = asyncHandler(async (req, res) => {
  const { start, end, type, status, department, user_id } = req.query;
  const startDate = start || moment().startOf('month').format('YYYY-MM-DD');
  const endDate   = end   || moment().endOf('month').format('YYYY-MM-DD');

  const where = { start_date: { [Op.between]: [startDate, endDate] } };
  if (type)   where.type   = type;
  if (status) where.status = status;

  const userWhere = buildUserWhere(req);
  if (department) userWhere.department = department;
  if (user_id)    userWhere.id = user_id;

  const data = await Leave.findAll({
    where,
    include: [
      {
        model: User, as: 'user', where: userWhere,
        attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department',
                     'casual_leave_balance', 'sick_leave_balance', 'comp_off_balance'],
      },
      { model: User, as: 'reviewer', attributes: ['first_name', 'last_name'], required: false },
    ],
    order: [['start_date', 'DESC']],
  });

  res.json({ start: startDate, end: endDate, data });
});

exports.idleReport = asyncHandler(async (req, res) => {
  const { start, end, department, user_id } = req.query;
  const startDate = start || moment().format('YYYY-MM-DD');
  const endDate   = end   || moment().format('YYYY-MM-DD');

  const userWhere = buildUserWhere(req);
  if (department) userWhere.department = department;
  if (user_id)    userWhere.id = user_id;

  const data = await IdleLog.findAll({
    where: { date: { [Op.between]: [startDate, endDate] } },
    include: [{
      model: User, as: 'user', where: userWhere,
      attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department'],
    }],
    attributes: [
      'user_id',
      'date',
      [fn('SUM', col('idle_seconds')), 'total_idle_seconds'],
      [fn('COUNT', col('IdleLog.id')),  'idle_events'],
    ],
    group: ['user_id', 'date', 'user.id', 'user.employee_id', 'user.first_name', 'user.last_name', 'user.department'],
    order: [['date', 'DESC']],
  });

  res.json({ start: startDate, end: endDate, data });
});

// Resolve a [start, end] window (YYYY-MM-DD) for a reporting period from an anchor date.
function periodWindow(period, anchor) {
  const a = moment(anchor, 'YYYY-MM-DD', true).isValid() ? moment(anchor, 'YYYY-MM-DD') : moment();
  switch (period) {
    case 'weekly':  return [a.clone().startOf('isoWeek'), a.clone().endOf('isoWeek')];
    case 'monthly': return [a.clone().startOf('month'),   a.clone().endOf('month')];
    case 'yearly':  return [a.clone().startOf('year'),    a.clone().endOf('year')];
    case 'daily':
    default:        return [a.clone().startOf('day'),     a.clone().endOf('day')];
  }
}

/**
 * Idle Monitor historical report — idle, work, break & effective time aggregated
 * per employee over a period (daily | weekly | monthly | yearly), optionally
 * scoped global (all in the requester's reach), to one department, or to a single
 * employee. Leads are auto-restricted to their own team via buildUserWhere.
 */
exports.idleHistory = asyncHandler(async (req, res) => {
  const period = ['daily', 'weekly', 'monthly', 'yearly'].includes(req.query.period) ? req.query.period : 'monthly';
  const { date, department, user_id, format } = req.query;
  const [startM, endM] = periodWindow(period, date);
  const startDate = startM.format('YYYY-MM-DD');
  const endDate   = endM.format('YYYY-MM-DD');

  // department and user_id may be comma-separated lists (multi-select filters).
  const deptList = department ? String(department).split(',').map(s => s.trim()).filter(Boolean) : [];
  const userList = user_id   ? String(user_id).split(',').map(s => s.trim()).filter(Boolean)   : [];

  const userWhere = buildUserWhere(req);
  if (deptList.length) userWhere.department = { [Op.in]: deptList };
  if (userList.length) userWhere.id = { [Op.in]: userList };

  const scope = userList.length ? 'employee' : deptList.length ? 'department' : 'global';
  const zeroTotals = { employees: 0, idle_seconds: 0, idle_events: 0, long_idle: 0, break_seconds: 0, work_hours: 0, effective_hours: 0, present_days: 0 };

  // Universe of employees in scope
  const users = await User.findAll({
    where: userWhere,
    attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department'],
    raw: true,
  });
  if (!users.length) {
    if (format === 'xlsx') return sendIdleHistoryXlsx(res, { period, startDate, endDate, data: [], daily: [] });
    return res.json({ period, start: startDate, end: endDate, scope, totals: zeroTotals, data: [] });
  }
  const userMap = {};
  const scopedIds = [];
  for (const u of users) { userMap[u.id] = u; scopedIds.push(u.id); }

  // Idle aggregation (IdleLog)
  const idleRows = await IdleLog.findAll({
    where: { date: { [Op.between]: [startDate, endDate] }, user_id: { [Op.in]: scopedIds } },
    attributes: [
      'user_id',
      [fn('SUM', col('idle_seconds')), 'idle_seconds'],
      [fn('COUNT', col('id')), 'idle_events'],
      [fn('SUM', literal('CASE WHEN idle_seconds >= 1800 THEN 1 ELSE 0 END')), 'long_idle'],
    ],
    group: ['user_id'],
    raw: true,
  });
  const idleMap = {};
  for (const r of idleRows) idleMap[r.user_id] = r;

  // Work / break / present-days (Attendance)
  const attRows = await Attendance.findAll({
    where: { date: { [Op.between]: [startDate, endDate] }, user_id: { [Op.in]: scopedIds } },
    attributes: [
      'user_id',
      [fn('SUM', col('total_hours')), 'work_hours'],
      [fn('SUM', col('total_break_seconds')), 'break_seconds'],
      [fn('SUM', literal("CASE WHEN status IN ('present','half_day') THEN 1 ELSE 0 END")), 'present_days'],
    ],
    group: ['user_id'],
    raw: true,
  });
  const attMap = {};
  for (const r of attRows) attMap[r.user_id] = r;

  // Merge — keep only employees with activity in the window
  const totals = { ...zeroTotals };
  const data = [];
  for (const id of scopedIds) {
    const idle = idleMap[id], att = attMap[id];
    if (!idle && !att) continue;
    const idle_seconds  = parseInt(idle?.idle_seconds  || 0, 10);
    const idle_events   = parseInt(idle?.idle_events   || 0, 10);
    const long_idle     = parseInt(idle?.long_idle     || 0, 10);
    const break_seconds = parseInt(att?.break_seconds  || 0, 10);
    const work_hours    = parseFloat(att?.work_hours   || 0);
    const present_days  = parseInt(att?.present_days   || 0, 10);
    const effective_hours = parseFloat(Math.max(0, work_hours - idle_seconds / 3600).toFixed(2));
    data.push({
      user: userMap[id],
      idle_seconds, idle_events, long_idle, break_seconds, present_days,
      work_hours: parseFloat(work_hours.toFixed(2)),
      effective_hours,
      avg_idle_seconds: present_days ? Math.round(idle_seconds / present_days) : idle_seconds,
    });
    totals.employees    += 1;
    totals.idle_seconds += idle_seconds;
    totals.idle_events  += idle_events;
    totals.long_idle    += long_idle;
    totals.break_seconds+= break_seconds;
    totals.work_hours   += work_hours;
    totals.present_days += present_days;
  }
  totals.work_hours      = parseFloat(totals.work_hours.toFixed(2));
  totals.effective_hours = parseFloat(Math.max(0, totals.work_hours - totals.idle_seconds / 3600).toFixed(2));

  data.sort((a, b) => b.idle_seconds - a.idle_seconds);

  if (format === 'xlsx') {
    // Pull the per-day rows for the same scope + window for the "Daily Timeline" sheet.
    const daily = await Attendance.findAll({
      where: { date: { [Op.between]: [startDate, endDate] }, user_id: { [Op.in]: scopedIds } },
      include: [{ model: User, as: 'user', attributes: ['employee_id', 'first_name', 'last_name', 'department'] }],
      order: [['date', 'ASC']],
    });
    return sendIdleHistoryXlsx(res, { period, startDate, endDate, data, daily });
  }

  res.json({ period, start: startDate, end: endDate, scope, totals, data });
});

// Pending-leave count scoped to what THIS role actually acts on — kept identical
// to leaveController.pendingLeaves so the dashboard stat matches the list.
async function countActionablePending(req) {
  const role = req.user.role;
  const leaveWhere = { status: 'pending' };
  const userWhere  = { status: 'active' };

  if (role === 'lead') {
    userWhere.manager_id = req.user.id;
    leaveWhere.tl_status = null;
  } else if (role === 'hr') {
    leaveWhere[Op.or] = [{ tl_status: 'approved' }, { tl_skipped: true }];
    userWhere.role = 'employee';
  } else if (role === 'superuser') {
    leaveWhere[Op.or] = [{ tl_status: 'approved' }, { tl_skipped: true }];
    userWhere.role = { [Op.in]: ['lead', 'hr', 'superuser'] };
  } else {
    return 0;
  }
  return Leave.count({ where: leaveWhere, include: [{ model: User, as: 'user', where: userWhere, attributes: [] }] });
}

exports.dashboardStats = asyncHandler(async (req, res) => {
  // Use IST dates so the day boundary matches how attendance rows are dated
  // (clock-in stamps date = todayIST) and so counts roll over at IST midnight.
  const today = todayIST();
  const yesterday = nowIST().subtract(1, 'day').format('YYYY-MM-DD');
  const isWeekend = [0, 6].includes(moment(today).day());   // Sun=0, Sat=6 → non-working
  const allActiveWhere = buildUserWhere(req);
  const userInc = [{ model: User, as: 'user', where: allActiveWhere, attributes: [] }];

  // Overnight shift still open from yesterday = "working now" (counts present,
  // not absent) so the dashboard doesn't drop night staff after midnight.
  const overnightWhere = {
    date: yesterday,
    login_time: { [Op.ne]: null },
    status: { [Op.ne]: 'absent' },
    [Op.or]: [
      { logout_time: null },
      { login_time_2: { [Op.ne]: null }, logout_time_2: null },
    ],
  };

  // Counts are defined to MATCH the Team Attendance tabs exactly (status-based),
  // so the dashboard number equals the list you see when you click it:
  //   present  = today's records with status 'present' (+ overnight in-progress)
  //   absent   = active employees with NO non-absent record today (excl. overnight)
  //   on_leave / half_day = their respective statuses
  const [totalEmployees, presentToday, nonAbsentToday, onLeaveToday, halfDayToday, overnightWorking, pendingLeaves] = await Promise.all([
    User.count({ where: allActiveWhere }),
    Attendance.count({ where: { date: today, status: 'present' },              include: userInc }),
    Attendance.count({ where: { date: today, status: { [Op.ne]: 'absent' } },  include: userInc }),
    Attendance.count({ where: { date: today, status: 'on_leave' },             include: userInc }),
    Attendance.count({ where: { date: today, status: 'half_day' },             include: userInc }),
    Attendance.count({ where: overnightWhere,                                  include: userInc }),
    countActionablePending(req),
  ]);

  res.json({
    total_employees: totalEmployees,
    present_today:   presentToday + overnightWorking,
    // On weekends nobody is "absent" — it's a non-working day. Only those who
    // actually worked are counted; everyone else is simply off. Overnight staff
    // still mid-shift are excluded from the absent count.
    absent_today:    isWeekend ? 0 : Math.max(0, totalEmployees - nonAbsentToday - overnightWorking),
    on_leave_today:  onLeaveToday,
    half_day_today:  halfDayToday,
    pending_leaves:  pendingLeaves,
  });
});
