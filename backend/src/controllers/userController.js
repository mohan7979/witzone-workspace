const { Op }   = require('sequelize');
const { User, ShiftTemplate } = require('../models');
const { sendWelcomeEmail } = require('../utils/mailer');
const asyncHandler = require('../utils/asyncHandler');
const { v4: uuidv4 } = require('uuid');
const { LEAVE_POLICY } = require('../utils/leavePolicy');
const { recordAudit } = require('../utils/audit');

const WORK_MODE_LABELS = { wfo: 'Work From Office (WFO)', wfh: 'Work From Home (WFH)' };

// Employee Master Data fields (Personal Details form) — editable by HR on create/update.
const MASTER_FIELDS = [
  'blood_group', 'qualification', 'marital_status', 'spouse_name',
  'mobile_2', 'personal_email',
  'present_address', 'permanent_address', 'aadhaar_address',
  'father_name', 'father_mobile', 'mother_name', 'mother_mobile', 'sibling_details',
  'emergency_contact_1_name', 'emergency_contact_1_relationship', 'emergency_contact_1_number',
  'emergency_contact_2_name', 'emergency_contact_2_relationship', 'emergency_contact_2_number',
  'aadhaar_name', 'aadhaar_number', 'pan_number',
  'bank_account_number', 'bank_ifsc',
];

function pickMasterFields(body) {
  const out = {};
  for (const f of MASTER_FIELDS) {
    if (body[f] !== undefined) out[f] = body[f] === '' ? null : body[f];
  }
  return out;
}

exports.createUser = asyncHandler(async (req, res) => {
  const {
    employee_id, first_name, last_name, email, role,
    department, designation, phone, shift_id, manager_id,
    dob, doj, work_mode,
  } = req.body;

  if (!employee_id || !first_name || !last_name || !email || !role)
    return res.status(400).json({ message: 'employee_id, first_name, last_name, email and role are required' });

  const emailExists = await User.findOne({ where: { email } });
  if (emailExists) return res.status(409).json({ message: 'A user with this email already exists' });

  const idExists = await User.findOne({ where: { employee_id } });
  if (idExists) return res.status(409).json({ message: 'Employee ID already in use' });

  const tempPassword = uuidv4().slice(0, 10);
  const mode = work_mode === 'wfh' ? 'wfh' : 'wfo';

  // Set personal leave balance based on work mode
  const personalLeaveBalance = mode === 'wfh'
    ? LEAVE_POLICY.casual.annual_days_wfh   // 8
    : LEAVE_POLICY.casual.annual_days_wfo;  // 12

  const user = await User.create({
    employee_id, first_name, last_name, email, role,
    department, designation, phone, shift_id, manager_id,
    dob: dob || null, doj: doj || null,
    work_mode: mode,
    casual_leave_balance: personalLeaveBalance,
    password: tempPassword,
    password_reset_required: true,
    ...pickMasterFields(req.body),   // Employee Master Data (optional on create)
  });

  sendWelcomeEmail(email, first_name, employee_id, tempPassword).catch(() => {});
  res.status(201).json({ message: 'User created. Credentials sent to email.', user });
});

exports.listUsers = asyncHandler(async (req, res) => {
  const { role, department, status = 'active', search, page = 1, limit = 20 } = req.query;
  const where = {};
  if (status) where.status = status;
  if (role)   where.role = role;
  if (department) where.department = department;
  if (req.user.role === 'lead') where.manager_id = req.user.id;
  if (search) {
    where[Op.or] = [
      { first_name:  { [Op.like]: `%${search}%` } },
      { last_name:   { [Op.like]: `%${search}%` } },
      { email:       { [Op.like]: `%${search}%` } },
      { employee_id: { [Op.like]: `%${search}%` } },
    ];
  }

  const { count, rows } = await User.findAndCountAll({
    where,
    include: [
      { model: User, as: 'manager', attributes: ['id', 'first_name', 'last_name'] },
      { model: ShiftTemplate, as: 'shift', attributes: ['id', 'name', 'start_time', 'end_time'], required: false },
    ],
    order:  [['first_name', 'ASC']],
    limit:  parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
  });
  res.json({ total: count, data: rows });
});

exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id, {
    include: [
      { model: User, as: 'manager', attributes: ['id', 'first_name', 'last_name'] },
      { model: ShiftTemplate, as: 'shift', attributes: ['id', 'name', 'start_time', 'end_time'], required: false },
    ],
  });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user });
});

exports.updateUser = asyncHandler(async (req, res) => {
  const allowed = [
    'first_name', 'last_name', 'department', 'designation', 'phone',
    'shift_id', 'role', 'status', 'manager_id', 'dob', 'doj', 'work_mode',
    'casual_leave_balance', 'sick_leave_balance', 'comp_off_balance',
    'marriage_leave_balance', 'maternity_leave_balance',
    ...MASTER_FIELDS,
  ];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f] === '' ? null : req.body[f]; });

  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  // Snapshot fields we audit BEFORE mutating.
  const prevWorkMode = user.work_mode;
  const prevRole     = user.role;

  // If work_mode is being changed and personal leave balance wasn't explicitly set,
  // auto-adjust the personal leave balance to the new mode's default
  if (req.body.work_mode && !req.body.casual_leave_balance) {
    const newMode = req.body.work_mode;
    // Only auto-adjust if balance still matches the old mode's default (not manually tweaked)
    const wfoDefault = LEAVE_POLICY.casual.annual_days_wfo;
    const wfhDefault = LEAVE_POLICY.casual.annual_days_wfh;
    const current = parseFloat(user.casual_leave_balance);
    if (newMode === 'wfh' && current === wfoDefault) updates.casual_leave_balance = wfhDefault;
    if (newMode === 'wfo' && current === wfhDefault) updates.casual_leave_balance = wfoDefault;
  }

  await user.update(updates);

  // ── Audit sensitive changes ──────────────────────────────────────────────
  const empLabel = `${user.first_name} ${user.last_name} (${user.employee_id})`;
  if (updates.work_mode && updates.work_mode !== prevWorkMode) {
    await recordAudit(req.user, 'work_mode.change', {
      entity_type: 'user', entity_id: user.id, entity_label: empLabel,
      old_value: WORK_MODE_LABELS[prevWorkMode] || prevWorkMode,
      new_value: WORK_MODE_LABELS[updates.work_mode] || updates.work_mode,
    });
  }
  if (updates.role && updates.role !== prevRole) {
    await recordAudit(req.user, 'role.change', {
      entity_type: 'user', entity_id: user.id, entity_label: empLabel,
      old_value: prevRole, new_value: updates.role,
    });
  }

  res.json({ message: 'User updated', user });
});

// ─── Change work mode (HR only) — dedicated quick toggle, fully audited ───────
exports.changeWorkMode = asyncHandler(async (req, res) => {
  const { work_mode } = req.body;
  if (!['wfo', 'wfh'].includes(work_mode))
    return res.status(400).json({ message: 'work_mode must be "wfo" or "wfh"' });

  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const prevWorkMode = user.work_mode;
  if (prevWorkMode === work_mode)
    return res.status(400).json({ message: `Employee is already set to ${WORK_MODE_LABELS[work_mode]}` });

  const updates = { work_mode };
  // Keep personal-leave balance consistent with the new mode if it still sits on
  // the old mode's default (don't clobber a manually adjusted balance).
  const wfoDefault = LEAVE_POLICY.casual.annual_days_wfo;
  const wfhDefault = LEAVE_POLICY.casual.annual_days_wfh;
  const current = parseFloat(user.casual_leave_balance);
  if (work_mode === 'wfh' && current === wfoDefault) updates.casual_leave_balance = wfhDefault;
  if (work_mode === 'wfo' && current === wfhDefault) updates.casual_leave_balance = wfoDefault;

  await user.update(updates);

  await recordAudit(req.user, 'work_mode.change', {
    entity_type: 'user', entity_id: user.id,
    entity_label: `${user.first_name} ${user.last_name} (${user.employee_id})`,
    old_value: WORK_MODE_LABELS[prevWorkMode] || prevWorkMode,
    new_value: WORK_MODE_LABELS[work_mode],
    metadata: req.body.reason ? { reason: req.body.reason } : null,
  });

  res.json({ message: `Work mode changed to ${WORK_MODE_LABELS[work_mode]}`, user });
});

// ─── Grant Comp Off (HR only) ─────────────────────────────────────────────────
exports.grantCompOff = asyncHandler(async (req, res) => {
  const { days } = req.body;
  if (!days || isNaN(days) || parseFloat(days) <= 0)
    return res.status(400).json({ message: 'days must be a positive number' });

  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.status !== 'active') return res.status(400).json({ message: 'User is not active' });

  const newBalance = parseFloat(user.comp_off_balance) + parseFloat(days);
  await user.update({ comp_off_balance: newBalance });
  res.json({ message: `Granted ${days} comp off day(s). New balance: ${newBalance}`, user });
});

exports.terminateUser = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.status === 'inactive')
    return res.status(400).json({ message: 'User is already terminated' });
  if (String(user.id) === String(req.user.id))
    return res.status(400).json({ message: 'You cannot terminate your own account' });

  await user.update({ status: 'inactive', terminated_at: new Date() });
  res.json({ message: 'User terminated', user });
});

exports.reactivateUser = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.status !== 'inactive')
    return res.status(400).json({ message: 'User is not terminated' });

  await user.update({ status: 'active', terminated_at: null });
  res.json({ message: 'User reactivated', user });
});

exports.departments = asyncHandler(async (req, res) => {
  const result = await User.findAll({
    attributes: ['department'],
    where: { department: { [Op.ne]: null } },
    group: ['department'],
    raw: true,
  });
  res.json({ departments: result.map(r => r.department).filter(Boolean) });
});

exports.leaveBalances = asyncHandler(async (req, res) => {
  const users = await User.findAll({
    where: { status: 'active' },
    attributes: [
      'id', 'employee_id', 'first_name', 'last_name', 'department', 'designation', 'work_mode',
      'casual_leave_balance', 'sick_leave_balance', 'comp_off_balance',
      'marriage_leave_balance', 'maternity_leave_balance',
    ],
    order: [['first_name', 'ASC'], ['last_name', 'ASC']],
  });
  res.json({ data: users });
});
