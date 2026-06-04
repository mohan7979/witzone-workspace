const { AuditLog } = require('../models');

/**
 * Record an audit event. Best-effort: auditing must never break the primary
 * action, so failures are swallowed and logged to the console.
 *
 * @param {object} actor   The acting user (req.user) — may be null for system events.
 * @param {string} action  Stable machine key, e.g. 'work_mode.change'.
 * @param {object} opts     { entity_type, entity_id, entity_label, old_value, new_value, metadata }
 */
async function recordAudit(actor, action, opts = {}) {
  try {
    await AuditLog.create({
      actor_id:    actor?.id || null,
      actor_role:  actor?.role || null,
      actor_name:  actor ? `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || null : null,
      action,
      entity_type:  opts.entity_type || null,
      entity_id:    opts.entity_id != null ? String(opts.entity_id) : null,
      entity_label: opts.entity_label || null,
      old_value:    opts.old_value != null ? String(opts.old_value) : null,
      new_value:    opts.new_value != null ? String(opts.new_value) : null,
      metadata:     opts.metadata || null,
    });
  } catch (e) {
    console.error('[audit] failed to record', action, e.message);
  }
}

module.exports = { recordAudit };
