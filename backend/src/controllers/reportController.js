const { Op, fn, col, literal } = require('sequelize');
const moment = require('moment');
const { Attendance, Leave, IdleLog, User } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

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

exports.dashboardStats = asyncHandler(async (req, res) => {
  const today = moment().format('YYYY-MM-DD');

  // Count ALL active users (employees + leads + HR) — matches what the Employees page shows
  const allActiveWhere = buildUserWhere(req);

  const [totalEmployees, presentToday, pendingLeaves] = await Promise.all([
    User.count({ where: allActiveWhere }),

    // Present = clocked in today (any role)
    Attendance.count({
      where: { date: today, login_time: { [Op.ne]: null } },
      include: [{ model: User, as: 'user', where: allActiveWhere, attributes: [] }],
    }),

    Leave.count({
      where: { status: 'pending' },
      include: [{ model: User, as: 'user', where: allActiveWhere, attributes: [] }],
    }),
  ]);

  res.json({
    total_employees: totalEmployees,
    present_today:   presentToday,
    absent_today:    Math.max(0, totalEmployees - presentToday),
    pending_leaves:  pendingLeaves,
  });
});
