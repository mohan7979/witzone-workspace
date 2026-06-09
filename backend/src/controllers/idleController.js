const moment = require('moment-timezone');
const { IdleLog, User, Attendance } = require('../models');
const { Op, fn, col } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');
const { nowIST, todayIST, TZ } = require('../utils/ist');

const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 min
// An idle session at or beyond this length is flagged "long idle" for HR review.
const LONG_IDLE_SECONDS = 30 * 60; // 30 min
// Hard sanity ceiling: no single idle session inside one clocked-in day should
// exceed this. Guards the aggregates against corrupt readings (machine sleep,
// agent crash leaving a session open across a suspend, clock skew, etc.).
const MAX_REASONABLE_IDLE_SECONDS = 12 * 60 * 60; // 12 h

// Called by desktop agent every 60s.
// Session-based idle tracking: one open row (idle_end IS NULL) = currently idle session.
// This avoids unbounded row creation and prevents double-counting.
exports.heartbeat = asyncHandler(async (req, res) => {
  const { idle_seconds, machine_name, agent_version } = req.body;
  const now     = nowIST().toDate();  // IST-aware JS Date
  const date    = todayIST();         // IST date string
  // Clamp into a sane range so a corrupt reading can't poison the day's aggregate.
  const idleSec = Math.min(MAX_REASONABLE_IDLE_SECONDS, Math.max(0, parseInt(idle_seconds, 10) || 0));

  // Heartbeats only count when the user is actively clocked in (session 1 OR session 2 open)
  const attendance = await Attendance.findOne({
    where: {
      user_id: req.user.id,
      date,
      [Op.or]: [
        { login_time: { [Op.ne]: null }, logout_time: null },      // session 1 active
        { login_time_2: { [Op.ne]: null }, logout_time_2: null },  // session 2 active
      ],
    },
  });

  if (attendance) {
    if (attendance.on_break) {
      // ── On break: idle MUST NOT run. Close any accidentally open idle session.
      await IdleLog.update(
        { idle_end: now },
        { where: { user_id: req.user.id, date, idle_end: null } }
      );
      // Do not open new idle sessions while on break.
    } else if (idleSec > 60) {
      // ── User is idle (desktop idle detected, not on break)
      const openSession = await IdleLog.findOne({
        where: { user_id: req.user.id, date, idle_end: null },
      });
      if (openSession) {
        await openSession.update({ idle_seconds: idleSec, machine_name, agent_version });
      } else {
        await IdleLog.create({
          user_id:      req.user.id,
          date,
          idle_start:   new Date(now - idleSec * 1000),
          idle_end:     null,
          idle_seconds: idleSec,
          machine_name,
          agent_version,
        });
      }
    } else {
      // ── User is active — close any open idle session
      await IdleLog.update(
        { idle_end: now },
        { where: { user_id: req.user.id, date, idle_end: null } }
      );
    }
  }

  // Always update heartbeat so HR live monitor can detect disconnects
  await User.update(
    { last_heartbeat: now, last_idle_seconds: idleSec },
    { where: { id: req.user.id } }
  );

  res.json({ received: true, server_time: now });
});

// Employee: idle summary for a single date
exports.myIdleSummary = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const today = date || todayIST();

  const [logs, attendance] = await Promise.all([
    IdleLog.findAll({
      where: { user_id: req.user.id, date: today },
      order: [['idle_start', 'ASC']],
    }),
    Attendance.findOne({ where: { user_id: req.user.id, date: today } }),
  ]);

  const totalIdleSeconds  = logs.reduce((sum, l) => sum + (l.idle_seconds || 0), 0);
  const totalBreakSeconds = attendance?.total_break_seconds || 0;
  const longIdleSessions  = logs.filter(l => (l.idle_seconds || 0) >= LONG_IDLE_SECONDS).length;

  res.json({
    date:                today,
    logs,
    total_idle_seconds:  totalIdleSeconds,
    total_idle_minutes:  Math.round(totalIdleSeconds / 60),
    total_break_seconds: totalBreakSeconds,
    long_idle_sessions:  longIdleSessions,
  });
});

// HR/Lead: aggregated idle per employee for a date
exports.teamIdleSummary = asyncHandler(async (req, res) => {
  const { date, department } = req.query;
  const today = date || todayIST();

  const userWhere = { status: 'active' };
  if (department) userWhere.department = department;
  if (req.user.role === 'lead') userWhere.manager_id = req.user.id;

  const logs = await IdleLog.findAll({
    where: { date: today },
    include: [{
      model: User, as: 'user', where: userWhere,
      attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department'],
    }],
    attributes: [
      'user_id',
      [fn('SUM', col('idle_seconds')), 'total_idle_seconds'],
      [fn('COUNT', col('IdleLog.id')),  'idle_events'],
    ],
    // Include all user columns that appear in SELECT to satisfy ONLY_FULL_GROUP_BY
    group: ['user_id', 'user.id', 'user.employee_id', 'user.first_name', 'user.last_name', 'user.department'],
    raw: false,
  });

  // Pull each user's total break duration for the day so HR sees idle AND break.
  const userIds = logs.map(l => l.user_id).filter(Boolean);
  const breakMap = {};
  if (userIds.length) {
    const atts = await Attendance.findAll({
      where: { date: today, user_id: { [Op.in]: userIds } },
      attributes: ['user_id', 'total_break_seconds'],
      raw: true,
    });
    for (const a of atts) breakMap[a.user_id] = a.total_break_seconds || 0;
  }

  const data = logs.map((l) => {
    const plain = l.get ? l.get({ plain: true }) : l;
    return { ...plain, total_break_seconds: breakMap[plain.user_id] || 0 };
  });

  res.json({ date: today, data });
});

/**
 * Detailed idle timeline for a specific user+date.
 * Returns attendance record, all idle sessions, and a computed timeline
 * that interleaves work and idle periods chronologically.
 *
 * Access: employees can see their own; HR/leads can see their team.
 */
exports.idleDetail = asyncHandler(async (req, res) => {
  const { user_id, date } = req.query;
  const targetDate   = date || todayIST();
  const targetUserId = user_id || req.user.id;

  // Authorization checks
  if (req.user.role === 'employee' && String(targetUserId) !== String(req.user.id))
    return res.status(403).json({ message: 'Access denied' });

  if (req.user.role === 'lead') {
    const emp = await User.findByPk(targetUserId, { attributes: ['id', 'manager_id'] });
    if (!emp || String(emp.manager_id) !== String(req.user.id))
      return res.status(403).json({ message: 'Access denied' });
  }

  const [attendance, idleSessions, user] = await Promise.all([
    Attendance.findOne({ where: { user_id: targetUserId, date: targetDate } }),
    IdleLog.findAll({
      where: { user_id: targetUserId, date: targetDate },
      order: [['idle_start', 'ASC']],
      raw: true,
    }),
    User.findByPk(targetUserId, {
      attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department'],
    }),
  ]);

  if (!user) return res.status(404).json({ message: 'User not found' });

  // Build interleaved work/idle timeline
  const timeline = [];

  if (attendance?.login_time) {
    // login_time / logout_time are full timestamps — parse them directly. (Do NOT
    // concatenate with the date string: that yields an invalid moment and silently
    // drops every "work" segment from the timeline.)
    let cursor = moment.tz(attendance.login_time, TZ);
    const clockOut = attendance.logout_time
      ? moment.tz(attendance.logout_time, TZ)
      : nowIST(); // treat "still clocked in" as now (IST)

    for (const session of idleSessions) {
      if (!session.idle_start) continue;
      const idleStart = moment.tz(session.idle_start, TZ);
      const idleEnd   = session.idle_end ? moment.tz(session.idle_end, TZ) : nowIST();

      // Skip sessions that started before clock-in (data integrity guard)
      if (idleStart.isBefore(cursor)) continue;
      // Skip sessions that are entirely after clock-out
      if (idleStart.isAfter(clockOut)) break;

      // Work period before this idle session
      if (cursor.isBefore(idleStart)) {
        const mins = Math.round(idleStart.diff(cursor, 'minutes', true));
        if (mins > 0) {
          timeline.push({ type: 'work', start: cursor.toISOString(), end: idleStart.toISOString(), duration_minutes: mins });
        }
      }

      // Cap idle end at clock-out
      const cappedEnd = idleEnd.isAfter(clockOut) ? clockOut : idleEnd;
      const idleSecs  = Math.round(cappedEnd.diff(idleStart, 'seconds', true));
      const idleMins  = Math.round(idleSecs / 60);
      if (idleSecs > 0) {
        timeline.push({
          type: 'idle',
          start: idleStart.toISOString(),
          end: cappedEnd.toISOString(),
          duration_minutes: idleMins,
          duration_seconds: idleSecs,
          idle_seconds: session.idle_seconds,
          long_idle: idleSecs >= LONG_IDLE_SECONDS,  // flag sessions ≥ 30 min for review
        });
      }

      cursor = cappedEnd;
    }

    // Final work period after last idle → clock-out
    if (cursor.isBefore(clockOut)) {
      const mins = Math.round(clockOut.diff(cursor, 'minutes', true));
      if (mins > 0) {
        timeline.push({ type: 'work', start: cursor.toISOString(), end: clockOut.toISOString(), duration_minutes: mins });
      }
    }
  }

  const totalIdleSecs   = idleSessions.reduce((s, l) => s + (l.idle_seconds || 0), 0);
  const longIdleCount   = timeline.filter(t => t.type === 'idle' && t.long_idle).length;
  const totalBreakSecs  = attendance?.total_break_seconds || 0;

  res.json({
    date: targetDate,
    user,
    attendance,
    idle_sessions: idleSessions,
    timeline,
    total_idle_seconds:  totalIdleSecs,
    total_idle_minutes:  Math.round(totalIdleSecs / 60),
    total_break_seconds: totalBreakSecs,
    long_idle_sessions:  longIdleCount,
  });
});

/**
 * Live status — all employees currently in an active work session today, grouped:
 *   active       — heartbeat within 5 min, not on break, idle_seconds < 60
 *   idle         — heartbeat within 5 min, not on break, idle_seconds >= 60
 *   break        — currently on break (idle does NOT count as idle here)
 *   disconnected — in a session but no heartbeat in 5+ min
 * "In a session" means session 1 OR session 2 is open (a 2nd clock-in counts).
 */
exports.liveIdleStatus = asyncHandler(async (req, res) => {
  const now       = nowIST().toDate();
  const threshold = new Date(now - OFFLINE_THRESHOLD_MS);
  const today     = todayIST();

  const userWhere = { status: 'active' };
  if (req.user.role === 'lead') userWhere.manager_id = req.user.id;

  const clockedIn = await Attendance.findAll({
    where: { date: today, login_time: { [Op.ne]: null } },
    include: [{
      model: User, as: 'user', where: userWhere,
      attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department', 'last_heartbeat', 'last_idle_seconds'],
    }],
  });

  const active = [], idle = [], breaks = [], disconnected = [];

  for (const att of clockedIn) {
    const user = att.user;
    if (!user) continue;

    // "Live" = currently inside an open session (session 1 OR session 2).
    const s1Active = att.login_time   && !att.logout_time;
    const s2Active = att.login_time_2 && !att.logout_time_2;
    if (!s1Active && !s2Active) continue;   // fully clocked out → not live

    const hb = user.last_heartbeat ? new Date(user.last_heartbeat) : null;
    const entry = {
      user_id:        user.id,
      employee_id:    user.employee_id,
      first_name:     user.first_name,
      last_name:      user.last_name,
      department:     user.department,
      last_heartbeat: hb,
      idle_seconds:   user.last_idle_seconds,
      session:        s2Active ? 2 : 1,   // so the UI can show "Session 2"
    };

    if (!hb || hb < threshold) {
      disconnected.push({ ...entry, idle_seconds: null });
    } else if (att.on_break) {
      breaks.push(entry);                  // on break → not idle
    } else if ((user.last_idle_seconds || 0) >= 60) {
      idle.push(entry);
    } else {
      active.push(entry);
    }
  }

  res.json({ active, idle, break: breaks, disconnected });
});
