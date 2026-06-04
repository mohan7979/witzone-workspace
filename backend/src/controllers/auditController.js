const { AuditLog, User } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

// ─── List audit events (HR / Superuser) ───────────────────────────────────────
// Supports filtering by action prefix (e.g. 'work_mode', 'leave', 'role') and
// entity, with simple pagination. Newest first.
exports.listAudit = asyncHandler(async (req, res) => {
  const { action, entity_type, entity_id, page = 1, limit = 50 } = req.query;

  const where = {};
  if (action)      where.action = action;
  if (entity_type) where.entity_type = entity_type;
  if (entity_id)   where.entity_id = String(entity_id);

  const { count, rows } = await AuditLog.findAndCountAll({
    where,
    include: [{ model: User, as: 'actor', attributes: ['id', 'first_name', 'last_name', 'employee_id', 'role'], required: false }],
    order:  [['created_at', 'DESC']],
    limit:  parseInt(limit),
    offset: (parseInt(page) - 1) * parseInt(limit),
  });

  res.json({ total: count, data: rows });
});
