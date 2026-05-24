const jwt      = require('jsonwebtoken');
const { User } = require('../models');
const { sendPasswordResetEmail } = require('../utils/mailer');
const asyncHandler = require('../utils/asyncHandler');
const { v4: uuidv4 } = require('uuid');

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

// Safe user fields returned to client — never expose heartbeat/idle monitoring data
const safeUser = (user) => {
  const u = user.toJSON();
  delete u.last_heartbeat;
  delete u.last_idle_seconds;
  return u;
};

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' });

  const user = await User.findOne({ where: { email } });
  if (!user || !(await user.validatePassword(password)))
    return res.status(401).json({ message: 'Invalid credentials' });

  if (user.status !== 'active')
    return res.status(403).json({ message: 'Account is inactive or suspended' });

  await user.update({ last_login: new Date() });

  res.json({
    token: signToken(user.id),
    user:  safeUser(user),
    password_reset_required: user.password_reset_required,
  });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password)
    return res.status(400).json({ message: 'Both old and new passwords are required' });
  if (new_password.length < 8)
    return res.status(400).json({ message: 'Password must be at least 8 characters' });

  const user = await User.findByPk(req.user.id);
  if (!(await user.validatePassword(old_password)))
    return res.status(400).json({ message: 'Old password is incorrect' });

  await user.update({ password: new_password, password_reset_required: false });
  res.json({ message: 'Password changed successfully', user: safeUser(user) });
});

exports.adminResetPassword = asyncHandler(async (req, res) => {
  const { user_id } = req.params;

  const target = await User.findByPk(user_id);
  if (!target) return res.status(404).json({ message: 'User not found' });

  // Leads can only reset passwords for their own team members (employees)
  if (req.user.role === 'lead') {
    if (target.role !== 'employee' || String(target.manager_id) !== String(req.user.id))
      return res.status(403).json({ message: 'Leads can only reset passwords for their direct team members' });
  }

  const tempPassword = uuidv4().slice(0, 10);
  await target.update({ password: tempPassword, password_reset_required: true });
  await sendPasswordResetEmail(target.email, target.first_name, tempPassword);

  res.json({ message: 'Password reset. New credentials sent to employee email.' });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ user: safeUser(req.user) });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const allowed = ['first_name', 'last_name', 'phone'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (!Object.keys(updates).length)
    return res.status(400).json({ message: 'No valid fields to update' });

  const user = await User.findByPk(req.user.id);
  await user.update(updates);
  res.json({ user: safeUser(user) });
});
