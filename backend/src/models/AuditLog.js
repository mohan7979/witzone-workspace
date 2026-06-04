const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Append-only audit trail for sensitive / approval / role actions.
 * Never updated or deleted in normal operation — one row per event.
 */
const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

  // Who performed the action (null = system / automated).
  actor_id:   { type: DataTypes.UUID, allowNull: true },
  actor_role: { type: DataTypes.STRING(20) },
  actor_name: { type: DataTypes.STRING(120) },

  // What happened. action is a stable machine key, e.g. 'work_mode.change',
  // 'leave.tl_review', 'leave.hr_review', 'role.change'.
  action: { type: DataTypes.STRING(60), allowNull: false },

  // The thing acted upon.
  entity_type: { type: DataTypes.STRING(40) },   // 'user' | 'leave' | ...
  entity_id:   { type: DataTypes.STRING(64) },
  entity_label:{ type: DataTypes.STRING(160) },   // human-friendly (e.g. employee name)

  // Optional before/after snapshot + free-form context (comments, reason).
  old_value: { type: DataTypes.TEXT },
  new_value: { type: DataTypes.TEXT },
  metadata:  { type: DataTypes.JSON },
}, {
  tableName: 'audit_logs',
  updatedAt: false,   // append-only — only created_at matters
});

module.exports = AuditLog;
