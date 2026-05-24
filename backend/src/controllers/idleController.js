const moment = require('moment');
const { IdleLog, User, Attendance } = require('../models');
const { Op, fn, col } = require('sequelize');
const asyncHandler = require('../utils/asyncHandler');

const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 min

// Called by desktop agent every 60s.
// Session-based idle tracking: one open row (idle_end IS NULL) = currently idle session.
// This avoids unbounded row creation and prevents double-counting.
exports.heartbeat = asyncHandler(async (req, res) => {
  const { idle_seconds, machine_name, agent_version } = req.body;
  const now     = new Date();                              // always trust server time
  const date    = moment(now).format('YYYY-MM-DD');
  const idleSec = Math.max(0, parseInt(idle_seconds, 10) || 0);

  // Heartbeats only count when the user is actively clocked in
  const attendance = await Attendance.findOne({
    where: { user_id: req.user.id, date, login_time: { [Op.ne]: null }, logout_time: null },
  });

  if (attendance) {
    if (idleSec > 60) {
      // User is idle — maintain exactly one open session
      const openSession = await IdleLog.findOne({
        where: { user_id: req.user.id, date, idle_end: null },
      });
      if (openSession) {
        // Extend the running session with the latest idle duration from the agent
        await openSession.update({ idle_seconds: idleSec, machine_name, agent_version });
      } else {
        // New idle session started — back-compute the start time
        await IdleLog.create({
          user_id:      req.user.id,
          date,
          idle_start:   new Date(now - idleSec * 1000),
          idle_end:     null,     // open = currently idle
          idle_seconds: idleSec,
          machine_name,
          agent_version,
        });
      }
    } else {
      // User is active — close any open idle session
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
  const today = date || moment().format('YYYY-MM-DD');

  const logs = await IdleLog.findAll({
    where: { user_id: req.user.id, date: today },
    order: [['idle_start', 'ASC']],
  });

  const totalIdleSeconds = logs.reduce((sum, l) => sum + (l.idle_seconds || 0), 0);
  res.json({
    date:               today,
    logs,
    total_idle_seconds: totalIdleSeconds,
    total_idle_minutes: Math.round(totalIdleSeconds / 60),
  });
});

// HR/Lead: aggregated idle per employee for a date
exports.teamIdleSummary = asyncHandler(async (req, res) => {
  const { date, department } = req.query;
  const today = date || moment().format('YYYY-MM-DD');

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

  res.json({ date: today, data: logs });
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
  const targetDate   = date || moment().format('YYYY-MM-DD');
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
    let cursor = moment(`${targetDate} ${attendance.login_time}`);
    const clockOut = attendance.logout_time
      ? moment(`${targetDate} ${attendance.logout_time}`)
      : moment(); // treat "still clocked in" as now

    for (const session of idleSessions) {
      if (!session.idle_start) continue;
      const idleStart = moment(session.idle_start);
      const idleEnd   = session.idle_end ? moment(session.idle_end) : moment();

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
      const idleMins  = Math.round(cappedEnd.diff(idleStart, 'minutes', true));
      if (idleMins > 0) {
        timeline.push({
          type: 'idle',
          start: idleStart.toISOString(),
          end: cappedEnd.toISOString(),
          duration_minutes: idleMins,
          idle_seconds: session.idle_seconds,
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

  const totalIdleSecs = idleSessions.reduce((s, l) => s + (l.idle_seconds || 0), 0);

  res.json({
    date: targetDate,
    user,
    attendance,
    idle_sessions: idleSessions,
    timeline,
    total_idle_seconds: totalIdleSecs,
    total_idle_minutes: Math.round(totalIdleSecs / 60),
  });
});

/**
 * Live status — all employees who clocked in today, grouped by state:
 *   active       — heartbeat within 5 min, idle_seconds < 60
 *   idle         — heartbeat within 5 min, idle_seconds >= 60
 *   disconnected — clocked in but no heartbeat in 5+ min
 */
exports.liveIdleStatus = asyncHandler(async (req, res) => {
  const now       = new Date();
  const threshold = new Date(now - OFFLINE_THRESHOLD_MS);
  const today     = moment().format('YYYY-MM-DD');

  const userWhere = { status: 'active' };
  if (req.user.role === 'lead') userWhere.manager_id = req.user.id;

  const clockedIn = await Attendance.findAll({
    where: { date: today, login_time: { [Op.ne]: null } },
    include: [{
      model: User, as: 'user', where: userWhere,
      attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department', 'last_heartbeat', 'last_idle_seconds'],
    }],
  });

  const active = [], idle = [], disconnected = [];

  for (const att of clockedIn) {
    const user = att.user;
    if (!user) continue;

    // Skip employees who already clocked out — they're no longer "live"
    if (att.logout_time) continue;

    const hb = user.last_heartbeat ? new Date(user.last_heartbeat) : null;
    const entry = {
      user_id:        user.id,
      employee_id:    user.employee_id,
      first_name:     user.first_name,
      last_name:      user.last_name,
      department:     user.department,
      last_heartbeat: hb,
      idle_seconds:   user.last_idle_seconds,
    };

    if (!hb || hb < threshold) {
      disconnected.push({ ...entry, idle_seconds: null });
    } else if ((user.last_idle_seconds || 0) >= 60) {
      idle.push(entry);
    } else {
      active.push(entry);
    }
  }

  res.json({ active, idle, disconnected });
});
