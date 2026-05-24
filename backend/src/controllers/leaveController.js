const { Op }   = require('sequelize');
const moment   = require('moment');
const { Leave, User, Attendance } = require('../models');
const { sendLeaveNotificationEmail } = require('../utils/mailer');
const asyncHandler = require('../utils/asyncHandler');

const LEAVE_BALANCE_FIELDS = {
  casual:   'casual_leave_balance',
  sick:     'sick_leave_balance',
  comp_off: 'comp_off_balance',
};

const VALID_TYPES = ['casual', 'sick', 'comp_off', 'permission', 'unpaid'];

exports.apply = asyncHandler(async (req, res) => {
  const { type, start_date, end_date, start_time, end_time, reason } = req.body;

  if (!type || !VALID_TYPES.includes(type))
    return res.status(400).json({ message: `type must be one of: ${VALID_TYPES.join(', ')}` });
  if (!start_date)
    return res.status(400).json({ message: 'start_date is required' });
  if (!reason || !reason.trim())
    return res.status(400).json({ message: 'reason is required' });

  const isPermission = type === 'permission';
  let duration_days;

  if (isPermission) {
    if (!start_time || !end_time)
      return res.status(400).json({ message: 'start_time and end_time are required for permission' });
    const diff = moment(`${start_date} ${end_time}`).diff(moment(`${start_date} ${start_time}`), 'hours', true);
    if (diff <= 0)
      return res.status(400).json({ message: 'end_time must be after start_time' });
    duration_days = parseFloat((diff / 8).toFixed(2));
  } else {
    if (!end_date)
      return res.status(400).json({ message: 'end_date is required' });
    if (moment(end_date).isBefore(moment(start_date)))
      return res.status(400).json({ message: 'end_date must be on or after start_date' });
    duration_days = moment(end_date).diff(moment(start_date), 'days') + 1;
  }

  // Check for overlapping non-cancelled leaves
  const overlap = await Leave.findOne({
    where: {
      user_id: req.user.id,
      status:  { [Op.in]: ['pending', 'approved'] },
      start_date: { [Op.lte]: isPermission ? start_date : end_date },
      end_date:   { [Op.gte]: start_date },
    },
  });
  if (overlap)
    return res.status(400).json({ message: 'You already have a leave request overlapping these dates' });

  // Check balance (only for types that consume a balance)
  const balanceField = LEAVE_BALANCE_FIELDS[type];
  if (balanceField && parseFloat(req.user[balanceField]) < duration_days)
    return res.status(400).json({ message: `Insufficient ${type} leave balance` });

  const leave = await Leave.create({
    user_id:  req.user.id,
    type, start_date,
    end_date:   isPermission ? start_date : end_date,
    start_time: isPermission ? start_time : null,
    end_time:   isPermission ? end_time   : null,
    duration_days, reason,
    status: 'pending',
  });

  // Notify all leads and HR
  const managers = await User.findAll({ where: { role: { [Op.in]: ['lead', 'hr'] }, status: 'active' } });
  for (const m of managers) {
    sendLeaveNotificationEmail(m.email, req.user, leave, 'new').catch(() => {}); // non-blocking
  }

  res.status(201).json({ message: 'Leave application submitted', leave });
});

exports.myLeaves = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const where = { user_id: req.user.id };
  if (status) where.status = status;

  const { count, rows } = await Leave.findAndCountAll({
    where,
    include: [{ model: User, as: 'reviewer', attributes: ['first_name', 'last_name'] }],
    order:  [['created_at', 'DESC']],
    limit:  parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
  });
  res.json({ total: count, data: rows });
});

exports.cancel = asyncHandler(async (req, res) => {
  const leave = await Leave.findOne({ where: { id: req.params.id, user_id: req.user.id } });
  if (!leave) return res.status(404).json({ message: 'Leave not found' });

  if (!['pending', 'approved'].includes(leave.status))
    return res.status(400).json({ message: 'Only pending or approved leaves can be cancelled' });

  // Approved future leave: refund balance and revert attendance records
  if (leave.status === 'approved') {
    if (moment(leave.start_date).isBefore(moment(), 'day'))
      return res.status(400).json({ message: 'Cannot cancel a leave that has already started' });

    const balanceField = LEAVE_BALANCE_FIELDS[leave.type];
    if (balanceField) {
      const user = await User.findByPk(req.user.id);
      const restored = parseFloat(user[balanceField]) + parseFloat(leave.duration_days);
      await user.update({ [balanceField]: restored });
    }

    // Revert attendance on_leave rows back to absent (only future dates)
    let curr = moment(leave.start_date);
    const endDate = moment(leave.end_date);
    while (curr.isSameOrBefore(endDate)) {
      const day = curr.format('YYYY-MM-DD');
      await Attendance.update(
        { status: 'absent' },
        { where: { user_id: req.user.id, date: day, status: 'on_leave', login_time: null } }
      );
      curr.add(1, 'day');
    }
  }

  await leave.update({ status: 'cancelled' });
  res.json({ message: 'Leave cancelled' });
});

// HR / Lead: list leaves — defaults to pending, accepts any status
exports.pendingLeaves = asyncHandler(async (req, res) => {
  const { type, status = 'pending', page = 1, limit = 20 } = req.query;
  const where = {};
  if (status !== 'all') where.status = status;
  if (type) where.type = type;

  const userWhere = { status: 'active' };
  if (req.user.role === 'lead') userWhere.manager_id = req.user.id;

  const { count, rows } = await Leave.findAndCountAll({
    where,
    include: [{
      model: User, as: 'user', where: userWhere,
      attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department',
                   'casual_leave_balance', 'sick_leave_balance', 'comp_off_balance'],
    }, {
      model: User, as: 'reviewer', attributes: ['first_name', 'last_name'], required: false,
    }],
    order:  [['created_at', 'DESC']],
    limit:  parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
  });
  res.json({ total: count, data: rows });
});

exports.review = asyncHandler(async (req, res) => {
  const { action, comment } = req.body;
  if (!['approved', 'rejected'].includes(action))
    return res.status(400).json({ message: 'Action must be approved or rejected' });

  const leave = await Leave.findByPk(req.params.id, {
    include: [{ model: User, as: 'user' }],
  });
  if (!leave) return res.status(404).json({ message: 'Leave not found' });
  if (leave.status !== 'pending')
    return res.status(400).json({ message: 'Leave is no longer pending' });

  // Maker-checker: the person who applied cannot approve/reject their own leave
  if (String(leave.user_id) === String(req.user.id))
    return res.status(400).json({ message: 'You cannot review your own leave request' });

  await leave.update({
    status: action, reviewed_by: req.user.id,
    reviewer_comment: comment, reviewed_at: new Date(),
  });

  if (action === 'approved') {
    // Deduct balance
    const balanceField = LEAVE_BALANCE_FIELDS[leave.type];
    if (balanceField) {
      const user = leave.user;
      const newBalance = parseFloat(user[balanceField]) - parseFloat(leave.duration_days);
      await user.update({ [balanceField]: Math.max(0, newBalance) });
    }

    // Mark attendance — only update status if no clock-in exists for that day
    let curr = moment(leave.start_date);
    const endDate = moment(leave.end_date);
    while (curr.isSameOrBefore(endDate)) {
      const day = curr.format('YYYY-MM-DD');
      const existing = await Attendance.findOne({ where: { user_id: leave.user_id, date: day } });
      if (!existing) {
        await Attendance.create({ user_id: leave.user_id, date: day, status: 'on_leave' });
      } else if (!existing.login_time) {
        // Only update status if employee hasn't actually clocked in
        await existing.update({ status: 'on_leave' });
      }
      curr.add(1, 'day');
    }
  }

  sendLeaveNotificationEmail(leave.user.email, leave.user, leave, action).catch(() => {});
  res.json({ message: `Leave ${action}`, leave });
});
