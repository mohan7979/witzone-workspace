const { Op }   = require('sequelize');
const moment   = require('moment-timezone');
const { Attendance, User, IdleLog, Leave, Holiday, BreakLog } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { nowIST, todayIST, dayOfWeekIST, TZ } = require('../utils/ist');

// Human-readable holiday-type labels (kept in sync with the Holiday ENUM).
const HOLIDAY_TYPE_LABELS = {
  us_national:     'US National Holiday',
  indian_national: 'Indian National Holiday',
  client_specific: 'Client-Specific Holiday',
  company:         'Company Holiday',
  optional:        'Optional Holiday',
};

/* ─────────────────────────────────────────────────────────────────────────────
 * HELPERS
 * ───────────────────────────────────────────────────────────────────────────── */

/**
 * Calculate total hours across both sessions (in hours, rounded to 2dp).
 * Neither break time nor idle is subtracted here — those are tracked separately.
 */
function calcTotalHours(rec, s1Logout, s2Logout) {
  let total = 0;
  const s1In  = rec.login_time;
  const s2In  = rec.login_time_2;
  const s1Out = s1Logout || rec.logout_time;
  const s2Out = s2Logout || rec.logout_time_2;

  if (s1In && s1Out) total += (new Date(s1Out) - new Date(s1In)) / 3600000;
  if (s2In && s2Out) total += (new Date(s2Out) - new Date(s2In)) / 3600000;
  return parseFloat(total.toFixed(2));
}

/**
 * Determine which session is currently active (1, 2, or null).
 * Active = clocked in but not yet clocked out.
 */
function activeSession(rec) {
  if (!rec) return null;
  if (rec.login_time  && !rec.logout_time)  return 1;
  if (rec.login_time_2 && !rec.logout_time_2) return 2;
  return null;
}

/**
 * Derive a UI-friendly state string from the attendance record.
 */
function deriveState(rec) {
  if (!rec || !rec.login_time) return 'not_started';
  if (!rec.logout_time)        return rec.on_break ? 'on_break' : 'session1_active';
  if (!rec.login_time_2)       return 'between_sessions';
  if (!rec.logout_time_2)      return rec.on_break ? 'on_break' : 'session2_active';
  return 'day_complete';
}

/**
 * End an open break and persist the accumulated seconds.
 * Returns the updated break_seconds delta (so callers can log it).
 */
async function resolveBreak(rec, now) {
  if (!rec.on_break || !rec.break_start) return 0;
  const delta = Math.round((now - new Date(rec.break_start)) / 1000);
  const newTotal = (rec.total_break_seconds || 0) + delta;
  await rec.update({ on_break: false, break_start: null, total_break_seconds: newTotal });

  // Close the open break-log row (Break Out) so HR sees an exact in/out pair.
  const openBreak = await BreakLog.findOne({
    where: { user_id: rec.user_id, date: rec.date, break_end: null },
    order: [['break_start', 'DESC']],
  });
  if (openBreak) {
    const dur = Math.round((now - new Date(openBreak.break_start)) / 1000);
    await openBreak.update({ break_end: now, duration_seconds: Math.max(0, dur) });
  }
  return delta;
}

/**
 * Finalize clock-out: close idle sessions, compute totals, set status.
 * `logoutField` is either 'logout_time' (session 1) or 'logout_time_2' (session 2).
 */
async function finalizeClockOut(rec, now, logoutField, logoutIp) {
  const today = todayIST();

  // 1. Auto-end any open break first
  await resolveBreak(rec, now);

  // 2. Close any open idle sessions
  await IdleLog.update(
    { idle_end: now },
    { where: { user_id: rec.user_id, date: today, idle_end: null } }
  );

  // 3. Sum idle seconds for the day
  const idleLogs   = await IdleLog.findAll({ where: { user_id: rec.user_id, date: today } });
  const idleSecs   = idleLogs.reduce((s, l) => s + (l.idle_seconds || 0), 0);

  // 4. Total hours across all completed sessions
  const updates   = { [logoutField]: now, [`${logoutField}_ip`]: logoutIp };
  // Compute total using the new logout value
  const s1Out = logoutField === 'logout_time'  ? now : rec.logout_time;
  const s2Out = logoutField === 'logout_time_2' ? now : rec.logout_time_2;
  const totalHrs  = calcTotalHours(rec, s1Out, s2Out);
  const effectiveHrs = parseFloat(Math.max(0, totalHrs - idleSecs / 3600).toFixed(2));
  // A two-session day (clocked in a second time) counts as present regardless of
  // hours; a single short session (< 4.5h) is a half day.
  const status    = (rec.login_time_2 || totalHrs >= 4.5) ? 'present' : 'half_day';

  await rec.update({
    ...updates,
    total_hours: totalHrs,
    idle_seconds: idleSecs,
    effective_hours: effectiveHrs,
    status,
    // Reset break state cleanly
    on_break: false,
    break_start: null,
  });

  return rec;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * CLOCK IN
 * Two sessions per day max. Session 2 can start after Session 1 is done.
 * ───────────────────────────────────────────────────────────────────────────── */
exports.clockIn = asyncHandler(async (req, res) => {
  const today = todayIST();
  const now   = nowIST().toDate();

  let rec = await Attendance.findOne({ where: { user_id: req.user.id, date: today } });

  /* ── Session 1 ── */
  if (!rec || !rec.login_time) {
    if (rec) {
      await rec.update({ login_time: now, status: 'present', login_ip: req.ip });
    } else {
      rec = await Attendance.create({
        user_id: req.user.id, date: today,
        login_time: now, status: 'present', login_ip: req.ip,
        on_break: false, total_break_seconds: 0,
      });
    }
    return res.json({ message: 'Clocked in (Session 1)', attendance: rec, state: 'session1_active' });
  }

  /* ── Already in Session 1 ── */
  if (!rec.logout_time) {
    return res.status(400).json({
      message: rec.on_break
        ? 'You are on a break. End the break before clocking out.'
        : 'Already clocked in. Clock out first.',
    });
  }

  /* ── Session 2 ── */
  if (!rec.login_time_2) {
    // Back at work for a second session → they're present again (a short first
    // session may have flipped the day to half_day at clock-out; undo that).
    await rec.update({ login_time_2: now, status: 'present' });
    return res.json({ message: 'Clocked in (Session 2)', attendance: rec, state: 'session2_active' });
  }

  /* ── Already in Session 2 ── */
  if (!rec.logout_time_2) {
    return res.status(400).json({
      message: rec.on_break
        ? 'You are on a break. End the break before clocking out.'
        : 'Already clocked in (Session 2). Clock out first.',
    });
  }

  /* ── Both sessions complete ── */
  return res.status(400).json({
    message: 'Maximum 2 sessions for today are already completed.',
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
 * CLOCK OUT
 * ───────────────────────────────────────────────────────────────────────────── */
exports.clockOut = asyncHandler(async (req, res) => {
  const today = todayIST();
  const now   = nowIST().toDate();

  const rec = await Attendance.findOne({ where: { user_id: req.user.id, date: today } });

  if (!rec || !rec.login_time) {
    return res.status(400).json({ message: 'No clock-in found for today.' });
  }

  const session = activeSession(rec);

  if (!session) {
    return res.status(400).json({
      message: rec.logout_time_2
        ? 'Both sessions for today are already closed.'
        : 'Not clocked in. Start a session first.',
    });
  }

  const logoutField = session === 1 ? 'logout_time' : 'logout_time_2';
  await finalizeClockOut(rec, now, logoutField, req.ip);

  // Reload to get latest values
  await rec.reload();

  return res.json({
    message: `Clocked out (Session ${session})`,
    attendance: rec,
    state: deriveState(rec),
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
 * START BREAK
 * Only allowed when actively clocked in (session open, not already on break).
 * ───────────────────────────────────────────────────────────────────────────── */
exports.startBreak = asyncHandler(async (req, res) => {
  const today = todayIST();
  const now   = nowIST().toDate();

  const rec = await Attendance.findOne({ where: { user_id: req.user.id, date: today } });

  if (!rec || !activeSession(rec)) {
    return res.status(400).json({ message: 'You must be clocked in to start a break.' });
  }
  if (rec.on_break) {
    return res.status(400).json({ message: 'Already on a break.' });
  }

  await rec.update({ on_break: true, break_start: now });

  // Open a break-log row (Break In) — closed with break_end on endBreak/clock-out.
  await BreakLog.create({ user_id: req.user.id, date: today, break_start: now });

  // Close any running idle session — you can't be idle AND on break
  await IdleLog.update(
    { idle_end: now },
    { where: { user_id: req.user.id, date: today, idle_end: null } }
  );

  await rec.reload();
  return res.json({ message: 'Break started', attendance: rec, state: 'on_break' });
});

/* ─────────────────────────────────────────────────────────────────────────────
 * END BREAK
 * ───────────────────────────────────────────────────────────────────────────── */
exports.endBreak = asyncHandler(async (req, res) => {
  const today = todayIST();
  const now   = nowIST().toDate();

  const rec = await Attendance.findOne({ where: { user_id: req.user.id, date: today } });

  if (!rec || !rec.on_break) {
    return res.status(400).json({ message: 'You are not on a break.' });
  }

  const delta = await resolveBreak(rec, now);
  await rec.reload();

  const minutes = Math.round(delta / 60);
  return res.json({
    message: `Break ended (${minutes} min)`,
    attendance: rec,
    state: deriveState(rec),
    break_minutes: minutes,
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
 * TODAY STATUS
 * Returns full attendance record + computed state, session info, and flags.
 * ───────────────────────────────────────────────────────────────────────────── */
exports.todayStatus = asyncHandler(async (req, res) => {
  const today = todayIST();
  const rec   = await Attendance.findOne({ where: { user_id: req.user.id, date: today } });

  const state  = deriveState(rec);
  const sessNo = activeSession(rec);

  // Current break duration (live) if on break
  const liveBreakSeconds = rec?.on_break && rec?.break_start
    ? Math.round((Date.now() - new Date(rec.break_start).getTime()) / 1000)
    : 0;

  return res.json({
    attendance: rec || null,
    state,
    active_session:       sessNo,
    can_clock_in:         !rec?.login_time || (!rec?.login_time_2 && !!rec?.logout_time && !rec?.logout_time_2 === false) || state === 'between_sessions',
    can_clock_out:        !!sessNo,
    can_break:            !!sessNo && !rec?.on_break,
    on_break:             rec?.on_break || false,
    live_break_seconds:   liveBreakSeconds,
    total_break_seconds:  (rec?.total_break_seconds || 0) + liveBreakSeconds,
  });
});

/* ─────────────────────────────────────────────────────────────────────────────
 * MY HISTORY
 * ───────────────────────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────────────────────
 * TEAM ATTENDANCE (HR / Lead)
 * ───────────────────────────────────────────────────────────────────────────── */
exports.teamAttendance = asyncHandler(async (req, res) => {
  const { date, department, page = 1, limit = 200 } = req.query;
  const today = date || todayIST();

  const dayOfWeek = dayOfWeekIST(today);
  const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;

  const userWhere = { status: 'active' };
  if (department) userWhere.department = department;
  if (req.user.role === 'lead') userWhere.manager_id = req.user.id;

  // Weekends are non-working days. Rather than marking everyone absent, show ONLY
  // the employees who actually clocked in (e.g. emergency Saturday work). Others
  // are simply off — never flagged absent.
  if (isWeekendDay) {
    const worked = await Attendance.findAll({
      where: { date: today, login_time: { [Op.ne]: null } },
      include: [{
        model: User, as: 'user', where: userWhere,
        attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department', 'designation'],
      }],
    });
    const lim = parseInt(limit);
    const offset = (parseInt(page) - 1) * lim;
    return res.json({ date: today, weekend: true, total: worked.length, data: worked.slice(offset, offset + lim) });
  }

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

  const recordByUserId = {};
  for (const r of records) {
    if (r.user?.id) recordByUserId[r.user.id] = r;
  }

  const rows = employees.map((emp) => {
    const rec = recordByUserId[emp.id];
    if (rec) return rec;
    return {
      id: null, user_id: emp.id, date: today,
      login_time: null, logout_time: null,
      login_time_2: null, logout_time_2: null,
      total_hours: null, effective_hours: null, idle_seconds: null,
      on_break: false, total_break_seconds: 0,
      status: 'absent', user: emp,
    };
  });

  const lim    = parseInt(limit);
  const offset = (parseInt(page) - 1) * lim;
  const paged  = rows.slice(offset, offset + lim);

  res.json({ date: today, total: rows.length, data: paged });
});

/* ─────────────────────────────────────────────────────────────────────────────
 * CALENDAR VIEW
 * ───────────────────────────────────────────────────────────────────────────── */
function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

function hoursDetail(att) {
  const hrs  = parseFloat(att.total_hours     || 0).toFixed(1);
  const eff  = parseFloat(att.effective_hours || 0).toFixed(1);
  const idle = att.idle_seconds ? `${Math.round(att.idle_seconds / 60)}m idle` : '';
  const brk  = att.total_break_seconds > 0 ? `${Math.round(att.total_break_seconds / 60)}m break` : '';
  return [`${hrs}h worked`, eff !== hrs ? `${eff}h effective` : null, idle || null, brk || null]
    .filter(Boolean).join(' · ');
}

exports.calendarView = asyncHandler(async (req, res) => {
  const nowIST_m = nowIST();
  const y = parseInt(req.query.year)  || nowIST_m.year();
  const m = parseInt(req.query.month) || (nowIST_m.month() + 1);

  const startStr = moment.tz(`${y}-${String(m).padStart(2, '0')}-01`, TZ).format('YYYY-MM-DD');
  const endStr   = moment.tz(startStr, TZ).endOf('month').format('YYYY-MM-DD');
  const today    = todayIST();
  const userId   = req.user.id;

  const [attendances, leaves, holidays] = await Promise.all([
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
    Holiday.findAll({
      where: { date: { [Op.between]: [startStr, endStr] } },
      raw: true,
    }),
  ]);

  const attMap = {};
  for (const a of attendances) attMap[a.date] = a;

  const leaveMap = {};
  for (const lv of leaves) {
    let cur = moment.tz(lv.start_date, TZ);
    const lvEnd = moment.tz(lv.end_date, TZ);
    while (cur.isSameOrBefore(lvEnd)) {
      const d = cur.format('YYYY-MM-DD');
      if (d >= startStr && d <= endStr) leaveMap[d] = lv;
      cur.add(1, 'day');
    }
  }

  // Holidays declared by HR (Holiday table) — keyed by date string. Normalise the
  // DATEONLY value to YYYY-MM-DD so it matches the calendar grid keys.
  const holidayMap = {};
  for (const h of holidays) {
    const d = moment.tz(h.date, TZ).format('YYYY-MM-DD');
    holidayMap[d] = h;
  }

  const days = {};
  let cur = moment.tz(startStr, TZ);

  while (cur.isSameOrBefore(moment.tz(endStr, TZ))) {
    const d         = cur.format('YYYY-MM-DD');
    const att       = attMap[d];
    const lv        = leaveMap[d];
    const hol       = holidayMap[d];
    const isFuture  = d > today;
    const isWeekend = dayOfWeekIST(d) === 0 || dayOfWeekIST(d) === 6;

    let entry = null;

    // Priority order:
    //  1. Actual work logged (present / half day) — shown even on holidays/weekends
    //  2. On leave (attendance flagged on_leave, or an overlapping leave request)
    //  3. Holiday declared by HR (Holiday table) or legacy holiday attendance status
    //  4. Absent (explicit record, or derived for a past working day)
    if (att && att.status === 'present') {
      entry = {
        type: 'present', label: 'Present', detail: hoursDetail(att),
        login_time: att.login_time, logout_time: att.logout_time,
        login_time_2: att.login_time_2, logout_time_2: att.logout_time_2,
      };
    } else if (att && att.status === 'half_day') {
      entry = {
        type: 'half_day', label: 'Half Day', detail: hoursDetail(att),
        login_time: att.login_time, logout_time: att.logout_time,
        login_time_2: att.login_time_2, logout_time_2: att.logout_time_2,
      };
    } else if ((att && att.status === 'on_leave') || lv) {
      const lvLabel = lv ? `${capitalize(lv.type.replace(/_/g, ' '))} Leave` : 'On Leave';
      const pending = lv && lv.status === 'pending';
      entry = {
        type: isFuture ? 'leave_upcoming' : 'leave',
        label: pending ? `${lvLabel} (Pending)` : lvLabel,
        detail: lv?.reason || '', leave_status: lv?.status,
      };
    } else if (hol) {
      entry = {
        type: 'holiday',
        label: hol.name || 'Holiday',
        detail: HOLIDAY_TYPE_LABELS[hol.type] || 'Public Holiday',
      };
    } else if (att && att.status === 'holiday') {
      entry = { type: 'holiday', label: 'Holiday', detail: att.notes || 'Public Holiday' };
    } else if (att && att.status === 'absent') {
      entry = { type: 'absent', label: 'Absent', detail: '' };
    } else if (!isFuture && !isWeekend) {
      entry = { type: 'absent', label: 'Absent', detail: 'No clock-in recorded' };
    }

    if (entry) days[d] = entry;
    cur.add(1, 'day');
  }

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
