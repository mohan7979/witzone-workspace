const { Op }   = require('sequelize');
const moment   = require('moment');
const { Leave, User, Attendance } = require('../models');
const {
  sendLeaveNotificationEmail,
  sendTlNotificationEmail,
  sendHrNotificationEmail,
} = require('../utils/mailer');
const asyncHandler = require('../utils/asyncHandler');

const LEAVE_BALANCE_FIELDS = {
  casual:   'casual_leave_balance',
  sick:     'sick_leave_balance',
  comp_off: 'comp_off_balance',
  wfh:      'wfh_leave_balance',
  wfo:      'wfo_leave_balance',
  marriage: 'marriage_leave_balance',
  maternity:'maternity_leave_balance',
};

const VALID_TYPES = [
  'casual', 'sick', 'comp_off', 'permission', 'unpaid',
  'wfh', 'wfo', 'marriage', 'maternity',
];

// ─── Apply for leave ──────────────────────────────────────────────────────────
exports.apply = asyncHandler(async (req, res) => {
  const { type, start_date, end_date, start_time, end_time, reason, document_note } = req.body;

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

  // Check balance
  const balanceField = LEAVE_BALANCE_FIELDS[type];
  if (balanceField && parseFloat(req.user[balanceField]) < duration_days)
    return res.status(400).json({ message: `Insufficient ${type} leave balance` });

  // If employee has no manager, TL stage is skipped — set tl_status to approved immediately
  const skipTl = !req.user.manager_id;

  const leave = await Leave.create({
    user_id:  req.user.id,
    type, start_date,
    end_date:      isPermission ? start_date : end_date,
    start_time:    isPermission ? start_time : null,
    end_time:      isPermission ? end_time   : null,
    duration_days, reason,
    document_note: document_note || null,
    status:    'pending',
    tl_status: skipTl ? 'approved' : null,
  });

  if (skipTl) {
    // No TL — notify all HR users directly
    const hrs = await User.findAll({ where: { role: 'hr', status: 'active' } });
    for (const hr of hrs) {
      sendHrNotificationEmail(hr.email, req.user, leave, 'N/A (no TL assigned)').catch(() => {});
    }
  } else {
    // Notify the assigned TL
    const tl = await User.findByPk(req.user.manager_id);
    if (tl) sendTlNotificationEmail(tl.email, req.user, leave).catch(() => {});
  }

  res.status(201).json({ message: 'Leave application submitted', leave });
});

// ─── My leaves ───────────────────────────────────────────────────────────────
exports.myLeaves = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const where = { user_id: req.user.id };
  if (status) where.status = status;

  const { count, rows } = await Leave.findAndCountAll({
    where,
    include: [
      { model: User, as: 'reviewer',   attributes: ['first_name', 'last_name'], required: false },
      { model: User, as: 'tlReviewer', attributes: ['first_name', 'last_name'], required: false },
    ],
    order:  [['created_at', 'DESC']],
    limit:  parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
  });
  res.json({ total: count, data: rows });
});

// ─── Cancel leave ─────────────────────────────────────────────────────────────
exports.cancel = asyncHandler(async (req, res) => {
  const leave = await Leave.findOne({ where: { id: req.params.id, user_id: req.user.id } });
  if (!leave) return res.status(404).json({ message: 'Leave not found' });

  if (!['pending', 'approved'].includes(leave.status))
    return res.status(400).json({ message: 'Only pending or approved leaves can be cancelled' });

  if (leave.status === 'approved') {
    if (moment(leave.start_date).isBefore(moment(), 'day'))
      return res.status(400).json({ message: 'Cannot cancel a leave that has already started' });

    const balanceField = LEAVE_BALANCE_FIELDS[leave.type];
    if (balanceField) {
      const user = await User.findByPk(req.user.id);
      const restored = parseFloat(user[balanceField]) + parseFloat(leave.duration_days);
      await user.update({ [balanceField]: restored });
    }

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

// ─── Pending leaves list (scoped by role) ─────────────────────────────────────
exports.pendingLeaves = asyncHandler(async (req, res) => {
  const { type, status, page = 1, limit = 20 } = req.query;
  const isHR   = req.user.role === 'hr';
  const isLead = req.user.role === 'lead';

  const leaveWhere = {};
  const userWhere  = { status: 'active' };

  if (type) leaveWhere.type = type;

  if (isLead) {
    // Lead sees only leaves pending their TL review (tl_status = null)
    userWhere.manager_id = req.user.id;
    if (status && status !== 'pending') {
      // Historical view — show their team's leaves with any status
      if (status !== 'all') leaveWhere.status = status;
    } else {
      leaveWhere.status    = 'pending';
      leaveWhere.tl_status = null;
    }
  } else if (isHR) {
    if (!status || status === 'pending') {
      // HR sees leaves where TL approved, waiting final HR decision
      leaveWhere.tl_status = 'approved';
      leaveWhere.status    = 'pending';
    } else if (status === 'all') {
      // No filter — show everything
    } else {
      leaveWhere.status = status;
    }
  }

  const { count, rows } = await Leave.findAndCountAll({
    where: leaveWhere,
    include: [
      {
        model: User, as: 'user', where: userWhere,
        attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department',
                     'casual_leave_balance', 'sick_leave_balance', 'comp_off_balance',
                     'wfh_leave_balance', 'wfo_leave_balance', 'marriage_leave_balance',
                     'maternity_leave_balance'],
      },
      { model: User, as: 'reviewer',   attributes: ['first_name', 'last_name'], required: false },
      { model: User, as: 'tlReviewer', attributes: ['first_name', 'last_name'], required: false },
    ],
    order:  [['created_at', 'DESC']],
    limit:  parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
  });
  res.json({ total: count, data: rows });
});

// ─── TL Level-1 review ────────────────────────────────────────────────────────
exports.tlReview = asyncHandler(async (req, res) => {
  const { action, comment } = req.body;
  if (!['approved', 'rejected'].includes(action))
    return res.status(400).json({ message: 'Action must be approved or rejected' });

  const leave = await Leave.findByPk(req.params.id, {
    include: [{ model: User, as: 'user' }],
  });
  if (!leave) return res.status(404).json({ message: 'Leave not found' });
  if (leave.status !== 'pending')
    return res.status(400).json({ message: 'Leave is no longer pending' });
  if (leave.tl_status !== null)
    return res.status(400).json({ message: 'This leave has already been reviewed at TL level' });

  // Only the assigned manager can TL-review
  if (String(leave.user.manager_id) !== String(req.user.id))
    return res.status(403).json({ message: 'You are not the assigned TL for this employee' });

  await leave.update({
    tl_status:      action,
    tl_reviewed_by: req.user.id,
    tl_comment:     comment || null,
    tl_reviewed_at: new Date(),
    // TL rejection ends the flow immediately
    ...(action === 'rejected' ? { status: 'rejected', reviewed_by: req.user.id, reviewer_comment: comment, reviewed_at: new Date() } : {}),
  });

  if (action === 'approved') {
    // Notify all HR users for final decision
    const hrs = await User.findAll({ where: { role: 'hr', status: 'active' } });
    const tlName = `${req.user.first_name} ${req.user.last_name}`;
    for (const hr of hrs) {
      sendHrNotificationEmail(hr.email, leave.user, leave, tlName).catch(() => {});
    }
    res.json({ message: 'Leave forwarded to HR for final approval', leave });
  } else {
    // Notify employee of TL rejection
    sendLeaveNotificationEmail(leave.user.email, leave.user, leave, 'tl_rejected').catch(() => {});
    res.json({ message: 'Leave rejected', leave });
  }
});

// ─── HR Level-2 final review ──────────────────────────────────────────────────
exports.hrReview = asyncHandler(async (req, res) => {
  const { action, comment } = req.body;
  if (!['approved', 'rejected'].includes(action))
    return res.status(400).json({ message: 'Action must be approved or rejected' });

  const leave = await Leave.findByPk(req.params.id, {
    include: [{ model: User, as: 'user' }],
  });
  if (!leave) return res.status(404).json({ message: 'Leave not found' });
  if (leave.status !== 'pending')
    return res.status(400).json({ message: 'Leave is no longer pending' });
  if (leave.tl_status !== 'approved')
    return res.status(400).json({ message: 'TL approval is required before HR can act' });

  await leave.update({
    status:           action,
    reviewed_by:      req.user.id,
    reviewer_comment: comment || null,
    reviewed_at:      new Date(),
  });

  if (action === 'approved') {
    const balanceField = LEAVE_BALANCE_FIELDS[leave.type];
    if (balanceField) {
      const user = leave.user;
      const newBalance = parseFloat(user[balanceField]) - parseFloat(leave.duration_days);
      await user.update({ [balanceField]: Math.max(0, newBalance) });
    }

    let curr = moment(leave.start_date);
    const endDate = moment(leave.end_date);
    while (curr.isSameOrBefore(endDate)) {
      const day = curr.format('YYYY-MM-DD');
      const existing = await Attendance.findOne({ where: { user_id: leave.user_id, date: day } });
      if (!existing) {
        await Attendance.create({ user_id: leave.user_id, date: day, status: 'on_leave' });
      } else if (!existing.login_time) {
        await existing.update({ status: 'on_leave' });
      }
      curr.add(1, 'day');
    }
  }

  sendLeaveNotificationEmail(leave.user.email, leave.user, leave, action).catch(() => {});
  res.json({ message: `Leave ${action}`, leave });
});
