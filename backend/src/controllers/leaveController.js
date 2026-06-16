const { Op }   = require('sequelize');
const moment   = require('moment');
const path     = require('path');
const fs       = require('fs');
const { Leave, User, Attendance } = require('../models');

// Where medical certificates are stored (matches middleware/upload.js).
const MEDICAL_DIR = path.join(__dirname, '../../uploads/medical');
const {
  sendLeaveNotificationEmail,
  sendTlNotificationEmail,
  sendHrNotificationEmail,
  sendReviewerOutcomeEmail,
} = require('../utils/mailer');
const asyncHandler = require('../utils/asyncHandler');
const { LEAVE_POLICY, computeAnnualReset } = require('../utils/leavePolicy');
const { recordAudit } = require('../utils/audit');

// Leave types that draw down a balance. Long Leave is intentionally NOT here:
// it's for emergencies, so it's applied without any count restriction (like Unpaid).
const LEAVE_BALANCE_FIELDS = {
  casual:     'casual_leave_balance',
  sick:       'sick_leave_balance',
  comp_off:   'comp_off_balance',
  marriage:   'marriage_leave_balance',
  maternity:  'maternity_leave_balance',
};

const VALID_TYPES = Object.keys(LEAVE_POLICY);

// Deduct the leave balance + mark attendance "on_leave" for a fully-approved leave.
async function finalizeApprovedLeave(leave) {
  const balanceField = LEAVE_BALANCE_FIELDS[leave.type];
  if (balanceField && leave.user) {
    const newBalance = parseFloat(leave.user[balanceField]) - parseFloat(leave.duration_days);
    await leave.user.update({ [balanceField]: Math.max(0, newBalance) });
  }
  let curr = moment(leave.start_date);
  const endDate = moment(leave.end_date);
  while (curr.isSameOrBefore(endDate)) {
    const day = curr.format('YYYY-MM-DD');
    const existing = await Attendance.findOne({ where: { user_id: leave.user_id, date: day } });
    if (!existing) await Attendance.create({ user_id: leave.user_id, date: day, status: 'on_leave' });
    else if (!existing.login_time) await existing.update({ status: 'on_leave' });
    curr.add(1, 'day');
  }
}

/**
 * Parallel two-level approval. TL and HR can each review at ANY time, in any
 * order. The leave is finally approved only when BOTH have approved (a leave with
 * no TL — tl_skipped — needs only the HR/Superuser approval); it's rejected the
 * moment either side rejects. Fires the appropriate notifications.
 */
async function resolveLeaveDecision(leave, actor, { stage }) {
  const tlOk     = leave.tl_status === 'approved' || leave.tl_skipped;
  const hrOk     = leave.hr_status === 'approved';
  const rejected = leave.tl_status === 'rejected' || leave.hr_status === 'rejected';

  if (rejected) {
    if (leave.status !== 'rejected') await leave.update({ status: 'rejected' });
    const byTl = leave.tl_status === 'rejected';
    sendLeaveNotificationEmail(leave.user.email, leave.user, leave, byTl ? 'tl_rejected' : 'rejected').catch(() => {});
    return 'rejected';
  }

  if (tlOk && hrOk) {
    if (leave.status !== 'approved') {
      await finalizeApprovedLeave(leave);
      await leave.update({ status: 'approved' });
    }
    sendLeaveNotificationEmail(leave.user.email, leave.user, leave, 'approved').catch(() => {});
    // FYI to the other reviewer who isn't acting now.
    const otherId = stage === 'hr' ? leave.tl_reviewed_by : leave.reviewed_by;
    if (otherId && String(otherId) !== String(actor.id)) {
      const other = await User.findByPk(otherId, { attributes: ['email', 'first_name', 'last_name'] });
      if (other) sendReviewerOutcomeEmail(other.email, `${other.first_name} ${other.last_name}`, leave.user, leave, 'approved', 'Approval').catch(() => {});
    }
    return 'approved';
  }

  // Still pending — one side approved, the other hasn't reviewed yet.
  if (stage === 'tl') {
    sendLeaveNotificationEmail(leave.user.email, leave.user, leave, 'tl_approved').catch(() => {});
    const tlName = `${actor.first_name} ${actor.last_name}`;
    const hrs = await User.findAll({ where: { role: 'hr', status: 'active' } });
    for (const hr of hrs) sendHrNotificationEmail(hr.email, leave.user, leave, tlName).catch(() => {});
  } else {
    sendLeaveNotificationEmail(leave.user.email, leave.user, leave, 'hr_approved').catch(() => {});
    if (leave.user.manager_id) {
      const tl = await User.findByPk(leave.user.manager_id, { attributes: ['email', 'first_name', 'last_name'] });
      if (tl) sendTlNotificationEmail(tl.email, leave.user, leave).catch(() => {});
    }
  }
  return 'pending';
}

// ─── Apply for leave ──────────────────────────────────────────────────────────
exports.apply = asyncHandler(async (req, res) => {
  const { type, start_date, end_date, start_time, end_time, reason, document_note } = req.body;
  const uploadedFile = req.file ? req.file.filename : null;

  if (!type || !VALID_TYPES.includes(type))
    return res.status(400).json({ message: `type must be one of: ${VALID_TYPES.join(', ')}` });
  if (!start_date)
    return res.status(400).json({ message: 'start_date is required' });
  if (!reason || !reason.trim())
    return res.status(400).json({ message: 'reason is required' });

  const isPermission = type === 'permission';
  const isHalfDay    = !isPermission && (req.body.is_half_day === true || req.body.is_half_day === 'true');
  let duration_days;

  if (isPermission) {
    if (!start_time || !end_time)
      return res.status(400).json({ message: 'start_time and end_time are required for permission' });
    const diff = moment(`${start_date} ${end_time}`).diff(moment(`${start_date} ${start_time}`), 'hours', true);
    if (diff <= 0)
      return res.status(400).json({ message: 'end_time must be after start_time' });
    // Permission is measured in hours; we still persist a day-fraction for balance
    // maths, but the exact hours come from start_time/end_time for display.
    duration_days = parseFloat((diff / 8).toFixed(2));
  } else if (isHalfDay) {
    // Half-day leave: a single date counted as 0.5 days, with a required time window.
    if (!start_time || !end_time)
      return res.status(400).json({ message: 'start_time and end_time are required for a half-day leave' });
    if (moment(`${start_date} ${end_time}`).diff(moment(`${start_date} ${start_time}`), 'minutes', true) <= 0)
      return res.status(400).json({ message: 'end_time must be after start_time' });
    duration_days = 0.5;
  } else {
    if (!end_date)
      return res.status(400).json({ message: 'end_date is required' });
    if (moment(end_date).isBefore(moment(start_date)))
      return res.status(400).json({ message: 'end_date must be on or after start_date' });
    duration_days = moment(end_date).diff(moment(start_date), 'days') + 1;
  }

  // ── Policy enforcement ───────────────────────────────────────────────────
  const policy = LEAVE_POLICY[type];

  // Sick leave: medical certificate upload is mandatory
  if (policy?.requires_document && !uploadedFile) {
    return res.status(400).json({
      message: 'Sick leave requires a medical certificate (PDF, JPG or PNG, max 5 MB).',
    });
  }

  // Max days per application (marriage ≤ 5, maternity ≤ 90)
  if (policy?.max_at_once && duration_days > policy.max_at_once) {
    return res.status(400).json({
      message: `${policy.label} cannot exceed ${policy.max_at_once} days per application.`,
    });
  }
  // ─────────────────────────────────────────────────────────────────────────

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

  // Check balance (unpaid / permission don't need a balance)
  const balanceField = LEAVE_BALANCE_FIELDS[type];
  if (balanceField && parseFloat(req.user[balanceField]) < duration_days)
    return res.status(400).json({
      message: `Insufficient ${policy?.label || type} balance. Available: ${req.user[balanceField]} day(s).`,
    });

  // Approver routing — two parallel slots (tl_status = slot A, hr_status = slot B):
  //  • Employee       → slot A = their Team Lead (skipped if none → HR only), slot B = HR.
  //  • Team Lead / HR → slot A = HR, slot B = Superuser — BOTH review IN PARALLEL.
  //  • Superuser      → slot B = Superuser only (slot A skipped).
  // tl_skipped flags a bypassed slot A so the UI never shows a false "TL Approved".
  const requesterIsAdmin = req.user.role === 'lead' || req.user.role === 'hr';
  const skipTl = requesterIsAdmin ? false
    : req.user.role === 'superuser' ? true
    : !req.user.manager_id;

  const leave = await Leave.create({
    user_id:  req.user.id,
    type, start_date,
    end_date:      (isPermission || isHalfDay) ? start_date : end_date,
    start_time:    (isPermission || isHalfDay) ? start_time : null,
    end_time:      (isPermission || isHalfDay) ? end_time   : null,
    is_half_day:   isHalfDay,
    duration_days, reason,
    document_note: document_note || null,
    document_file: uploadedFile || null,
    status:        'pending',
    tl_status:     null,
    tl_skipped:    skipTl,
  });

  // Notify reviewers so both parallel slots can act in any order.
  if (requesterIsAdmin) {
    // Team Lead / HR request → HR (slot A) AND Superuser (slot B) both review now.
    const reviewers = await User.findAll({ where: { role: { [Op.in]: ['hr', 'superuser'] }, status: 'active' } });
    for (const a of reviewers) sendHrNotificationEmail(a.email, req.user, leave, 'Parallel review — HR & Superuser').catch(() => {});
  } else {
    // Employee request → HR always; Superuser request → Superuser. Plus the
    // assigned Team Lead (slot A) when one exists.
    const approverRole = req.user.role === 'superuser' ? 'superuser' : 'hr';
    const approvers = await User.findAll({ where: { role: approverRole, status: 'active' } });
    const tlLabel = skipTl ? 'N/A (no TL assigned)' : 'Pending Team Lead review';
    for (const a of approvers) sendHrNotificationEmail(a.email, req.user, leave, tlLabel).catch(() => {});
    if (!skipTl) {
      const tl = await User.findByPk(req.user.manager_id);
      if (tl) sendTlNotificationEmail(tl.email, req.user, leave).catch(() => {});
    }
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
  const isHR    = req.user.role === 'hr';
  const isLead  = req.user.role === 'lead';
  const isSuper = req.user.role === 'superuser';

  const leaveWhere = {};
  const userWhere  = { status: 'active' };

  if (type) leaveWhere.type = type;

  // Parallel approval: TL and HR each have their own pending queue and act in any
  // order. A request shows in a reviewer's "pending" queue until THEY decide it.
  if (isLead) {
    userWhere.manager_id = req.user.id;
    userWhere.role       = 'employee';     // a lead reviews their EMPLOYEES; TL requests go to HR + Superuser
    if (status && status !== 'pending') {
      if (status !== 'all') leaveWhere.status = status;
    } else {
      leaveWhere.status    = 'pending';
      leaveWhere.tl_status = null;          // awaiting THIS TL's review (HR may already have acted)
    }
  } else if (isHR) {
    if (!status || status === 'pending') {
      // Parallel: HR reviews EMPLOYEE requests (their hr_status slot) AND TEAM LEAD
      // requests (HR's tl_status slot, in parallel with the Superuser).
      leaveWhere.status = 'pending';
      leaveWhere[Op.or] = [
        { hr_status: null, '$user.role$': 'employee' },
        { tl_status: null, '$user.role$': 'lead' },
      ];
    } else if (status === 'all') {
      // full visibility
    } else {
      leaveWhere.status = status;
    }
  } else if (isSuper) {
    if (!status || status === 'pending') {
      // Superuser is the final approver for TL / HR / superuser requests.
      leaveWhere.status    = 'pending';
      leaveWhere.hr_status = null;
      userWhere.role       = { [Op.in]: ['lead', 'hr', 'superuser'] };
    } else if (status === 'all') {
      // full visibility
    } else {
      leaveWhere.status = status;
    }
  }

  const { count, rows } = await Leave.findAndCountAll({
    where: leaveWhere,
    include: [
      {
        model: User, as: 'user', where: userWhere,
        attributes: ['id', 'employee_id', 'first_name', 'last_name', 'role', 'department', 'work_mode', 'photo_thumb',
                     'casual_leave_balance', 'sick_leave_balance', 'comp_off_balance',
                     'marriage_leave_balance', 'maternity_leave_balance', 'long_leave_balance'],
      },
      { model: User, as: 'reviewer',   attributes: ['first_name', 'last_name'], required: false },
      { model: User, as: 'tlReviewer', attributes: ['first_name', 'last_name'], required: false },
    ],
    order:  [['created_at', 'DESC']],
    limit:  parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
    subQuery: false,   // so the $user.role$ OR conditions resolve correctly with limit/offset
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
    return res.status(400).json({ message: 'This level has already been reviewed' });

  // Who fills the first parallel slot (tl_status):
  //  • Employee request  → the employee's assigned Team Lead (manager).
  //  • Team Lead request → HR (reviews in parallel with the Superuser).
  const isAssignedTl  = String(leave.user.manager_id) === String(req.user.id);
  const isHrOnLeadReq = req.user.role === 'hr' && leave.user.role === 'lead';
  if (!isAssignedTl && !isHrOnLeadReq)
    return res.status(403).json({ message: 'You are not authorized to review this request at this level' });

  await leave.update({
    tl_status:      action,
    tl_reviewed_by: req.user.id,
    tl_comment:     comment || null,
    tl_reviewed_at: new Date(),
  });

  await recordAudit(req.user, 'leave.tl_review', {
    entity_type: 'leave', entity_id: leave.id,
    entity_label: `${leave.user.first_name} ${leave.user.last_name} · ${leave.type}`,
    new_value: `TL ${action}`,
    metadata: { decision: action, comment: comment || null, stage: 'tl' },
  });

  const result = await resolveLeaveDecision(leave, req.user, { stage: 'tl' });
  const nextReviewer = leave.user.role === 'lead' ? 'Superuser' : 'HR';
  const message = action === 'rejected'
    ? 'Leave rejected'
    : result === 'approved' ? 'Leave approved (both approvals complete)' : `Approved — awaiting ${nextReviewer} review`;
  res.json({ message, leave });
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
  if (leave.hr_status !== null)
    return res.status(400).json({ message: 'You have already reviewed this request' });

  // Separation of duties: leaves submitted by TLs / HR / superusers can only be
  // finalised by a Superuser. HR finalises employee leaves only.
  const isSuper = req.user.role === 'superuser';
  if (!isSuper && leave.user.role !== 'employee')
    return res.status(403).json({ message: 'Leave requests from Team Leads or HR can only be reviewed by a Superuser.' });

  await leave.update({
    hr_status:        action,
    reviewed_by:      req.user.id,
    reviewer_comment: comment || null,
    reviewed_at:      new Date(),
  });

  await recordAudit(req.user, 'leave.hr_review', {
    entity_type: 'leave', entity_id: leave.id,
    entity_label: `${leave.user.first_name} ${leave.user.last_name} · ${leave.type}`,
    new_value: `${isSuper ? 'Superuser' : 'HR'} ${action}`,
    metadata: { decision: action, comment: comment || null, stage: 'hr', tl_skipped: leave.tl_skipped },
  });

  const result = await resolveLeaveDecision(leave, req.user, { stage: 'hr' });
  const otherReviewer = leave.user.role === 'lead' ? 'HR' : 'Team Lead';
  const message = action === 'rejected'
    ? 'Leave rejected'
    : result === 'approved' ? 'Leave approved (both approvals complete)' : `Approved — awaiting ${otherReviewer} review`;
  res.json({ message, leave });
});

// ─── View the uploaded document (e.g. sick-leave medical certificate) ─────────
// Streamed through an authorised endpoint so the requester, their TL, HR and
// Superuser can open it — but no one else.
exports.viewDocument = asyncHandler(async (req, res) => {
  const leave = await Leave.findByPk(req.params.id, {
    include: [{ model: User, as: 'user', attributes: ['id', 'manager_id'] }],
  });
  if (!leave || !leave.document_file)
    return res.status(404).json({ message: 'No document attached to this request' });

  const u = req.user;
  const allowed =
    String(leave.user_id) === String(u.id) ||           // the requester
    u.role === 'hr' || u.role === 'superuser' ||          // HR / Superuser
    (u.role === 'lead' && leave.user && String(leave.user.manager_id) === String(u.id)); // their TL
  if (!allowed) return res.status(403).json({ message: 'Access denied' });

  const filePath = path.join(MEDICAL_DIR, path.basename(leave.document_file));
  if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Document file not found on server' });
  res.sendFile(filePath);
});

// ─── Get leave policy (frontend reads this) ───────────────────────────────────
exports.getPolicy = asyncHandler(async (req, res) => {
  res.json({ policy: LEAVE_POLICY });
});

// ─── Annual leave balance reset (HR only) ─────────────────────────────────────
// Resets annual leaves for all active employees.
// WFH: carry forward (unused + 8, capped at 16).
// All other annual leaves: reset to policy default.
// One-time / earned leaves (marriage, maternity, comp_off) are untouched.
exports.resetAnnualLeaves = asyncHandler(async (req, res) => {
  const employees = await User.findAll({ where: { status: 'active' } });
  const year = new Date().getFullYear();
  const results = [];

  for (const emp of employees) {
    const updates = computeAnnualReset(emp);
    await emp.update(updates);
    results.push({
      employee_id: emp.employee_id,
      name: `${emp.first_name} ${emp.last_name}`,
      updates,
    });
  }

  res.json({
    message: `Annual leave balances reset for ${year}. ${employees.length} employee(s) updated.`,
    year,
    details: results,
  });
});
