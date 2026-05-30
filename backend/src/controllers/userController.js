const { Op }   = require('sequelize');
const { User, ShiftTemplate } = require('../models');
const { sendWelcomeEmail } = require('../utils/mailer');
const asyncHandler = require('../utils/asyncHandler');
const { v4: uuidv4 } = require('uuid');

exports.createUser = asyncHandler(async (req, res) => {
  const {
    employee_id, first_name, last_name, email, role,
    department, designation, phone, shift_id, manager_id,
    dob, doj,
  } = req.body;

  if (!employee_id || !first_name || !last_name || !email || !role)
    return res.status(400).json({ message: 'employee_id, first_name, last_name, email and role are required' });

  const emailExists = await User.findOne({ where: { email } });
  if (emailExists) return res.status(409).json({ message: 'A user with this email already exists' });

  const idExists = await User.findOne({ where: { employee_id } });
  if (idExists) return res.status(409).json({ message: 'Employee ID already in use' });

  const tempPassword = uuidv4().slice(0, 10);

  const user = await User.create({
    employee_id, first_name, last_name, email, role,
    department, designation, phone, shift_id, manager_id,
    dob: dob || null, doj: doj || null,
    password: tempPassword,
    password_reset_required: true,
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
    'shift_id', 'role', 'status', 'manager_id', 'dob', 'doj',
    'casual_leave_balance', 'sick_leave_balance', 'comp_off_balance',
    'wfh_leave_balance', 'wfo_leave_balance', 'marriage_leave_balance', 'maternity_leave_balance',
  ];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  await user.update(updates);
  res.json({ message: 'User updated', user });
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
      'id', 'employee_id', 'first_name', 'last_name', 'department', 'designation',
      'casual_leave_balance', 'sick_leave_balance', 'comp_off_balance',
      'wfh_leave_balance', 'wfo_leave_balance', 'marriage_leave_balance', 'maternity_leave_balance',
    ],
    order: [['first_name', 'ASC'], ['last_name', 'ASC']],
  });
  res.json({ data: users });
});
