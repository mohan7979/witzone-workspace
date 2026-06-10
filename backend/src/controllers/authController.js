const jwt        = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { User }   = require('../models');
const { sendPasswordResetEmail } = require('../utils/mailer');
const asyncHandler = require('../utils/asyncHandler');
const { v4: uuidv4 } = require('uuid');

const signToken = (id, expiresIn) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || '8h' });

// Desktop-agent logins get a long-lived token so heartbeats don't die mid-shift
// (a browser session stays short for security). The agent also auto re-logins
// on expiry as a safety net.
const AGENT_TOKEN_TTL = process.env.JWT_AGENT_EXPIRES_IN || '30d';

// Safe user fields returned to client — never expose heartbeat/idle monitoring data
const safeUser = (user) => {
  const u = user.toJSON();
  delete u.last_heartbeat;
  delete u.last_idle_seconds;
  return u;
};

/* ── Microsoft Entra ID (Azure AD) SSO ─────────────────────────────── */

/**
 * Verify an Entra ID idToken using Microsoft's JWKS endpoint.
 * Returns the decoded payload (claims) or throws.
 */
async function verifyEntraToken(idToken) {
  const tenantId = process.env.AZURE_TENANT_ID;
  if (!tenantId) throw new Error('AZURE_TENANT_ID not configured on server');

  // Decode header first to get kid
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded) throw new Error('Invalid token format');

  const client = jwksClient({
    jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
    cache: true,
    rateLimit: true,
  });

  const getKey = (header, callback) => {
    client.getSigningKey(header.kid, (err, key) => {
      if (err) return callback(err);
      callback(null, key.getPublicKey());
    });
  };

  return new Promise((resolve, reject) => {
    jwt.verify(idToken, getKey, {
      algorithms: ['RS256'],
      audience: process.env.AZURE_CLIENT_ID,
      issuer: [
        `https://login.microsoftonline.com/${tenantId}/v2.0`,
        `https://sts.windows.net/${tenantId}/`,
      ],
    }, (err, payload) => {
      if (err) reject(err);
      else resolve(payload);
    });
  });
}

exports.ssoLogin = asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ message: 'idToken is required' });

  // Validate the Microsoft token
  let claims;
  try {
    claims = await verifyEntraToken(idToken);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid Microsoft token: ' + err.message });
  }

  // Extract email from token claims
  const email = claims.preferred_username || claims.email || claims.upn;
  if (!email) return res.status(401).json({ message: 'Email not found in Microsoft token' });

  // Find user in our database by email
  const user = await User.findOne({ where: { email: email.toLowerCase() } });
  if (!user) {
    return res.status(403).json({
      message: `No HRMS account found for ${email}. Contact your HR administrator.`,
    });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ message: 'Your account is inactive. Contact HR.' });
  }

  await user.update({ last_login: new Date() });

  res.json({
    token: signToken(user.id),
    user:  safeUser(user),
    password_reset_required: false, // SSO users skip password reset
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password, agent } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' });

  const user = await User.findOne({ where: { email } });
  if (!user || !(await user.validatePassword(password)))
    return res.status(401).json({ message: 'Invalid credentials' });

  if (user.status !== 'active')
    return res.status(403).json({ message: 'Account is inactive or suspended' });

  await user.update({ last_login: new Date() });

  res.json({
    token: signToken(user.id, agent ? AGENT_TOKEN_TTL : undefined),
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
  const allowed = ['first_name', 'last_name', 'phone', 'photo', 'photo_thumb'];
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
