const { Op } = require('sequelize');
const { User } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { sendAgentExitAlertEmail } = require('../utils/mailer');
const { toISTDateTime } = require('../utils/ist');

/**
 * The desktop agent asks to quit. Quitting is gated by an admin exit password
 * (AGENT_EXIT_PASSWORD) that employees don't know. EVERY attempt — whether the
 * password is right or wrong — is emailed to all active HR + Superusers.
 *
 * Authenticated as the employee (the agent's own token), so we know who tried.
 */
exports.exitAttempt = asyncHandler(async (req, res) => {
  const { password, machine_name } = req.body || {};
  const exitPwd = process.env.AGENT_EXIT_PASSWORD || '';
  const allow = exitPwd.length > 0 && password === exitPwd;

  // Alert HR + Superusers on every attempt (best-effort; never blocks the response).
  const admins = await User.findAll({
    where: { role: { [Op.in]: ['hr', 'superuser'] }, status: 'active' },
    attributes: ['email'],
  });
  const recipients = admins.map((a) => a.email).filter(Boolean);
  if (recipients.length) {
    sendAgentExitAlertEmail(
      recipients.join(','),
      req.user,
      machine_name || 'Unknown machine',
      allow,
      toISTDateTime(new Date()),
    ).catch(() => {});
  }

  res.json({ allow });
});
