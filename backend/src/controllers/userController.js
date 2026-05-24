const { Op }   = require('sequelize');
const { User } = require('../models');
const { sendWelcomeEmail } = require('../utils/mailer');
const asyncHandler = require('../utils/asyncHandler');
const { v4: uuidv4 } = require('uuid');

// Use MAX-based ID to avoid race conditions and survive deletions
const generateEmployeeId = async () => {
  const result = await User.findOne({
    attributes: [[require('sequelize').fn('MAX', require('sequelize').col('employee_id')), 'max_id']],
    raw: true,
  });
  const last = result?.max_id;
  const num  = last ? parseInt(last.replace(/\D/g, ''), 10) + 1 : 1;
  return `EMP${String(num).padStart(4, '0')}`;
};

exports.createUser = asyncHandler(async (req, res) => {
  const { first_name, last_name, email, role, department, designation, phone, shift_start, shift_end, manager_id } = req.body;

  if (!first_name || !last_name || !email || !role)
    return res.status(400).json({ message: 'first_name, last_name, email and role are required' });

  const exists = await User.findOne({ where: { email } });
  if (exists) return res.status(409).json({ message: 'A user with this email already exists' });

  const tempPassword = uuidv4().slice(0, 10);
  const employee_id  = await generateEmployeeId();

  const user = await User.create({
    first_name, last_name, email, role, department, designation,
    phone, shift_start, shift_end, manager_id,
    employee_id, password: tempPassword, password_reset_required: true,
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
    include: [{ model: User, as: 'manager', attributes: ['id', 'first_name', 'last_name'] }],
    order:  [['first_name', 'ASC']],
    limit:  parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
  });
  res.json({ total: count, data: rows });
});

exports.getUser = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.params.id, {
    include: [{ model: User, as: 'manager', attributes: ['id', 'first_name', 'last_name'] }],
  });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user });
});

exports.updateUser = asyncHandler(async (req, res) => {
  const allowed = ['first_name', 'last_name', 'department', 'designation', 'phone',
                   'shift_start', 'shift_end', 'role', 'status', 'manager_id',
                   'casual_leave_balance', 'sick_leave_balance', 'comp_off_balance'];
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
  // Prevent HR from accidentally terminating themselves
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
    attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department', 'designation',
                 'casual_leave_balance', 'sick_leave_balance', 'comp_off_balance'],
    order: [['first_name', 'ASC'], ['last_name', 'ASC']],
  });
  res.json({ data: users });
});
