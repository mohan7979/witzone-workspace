/**
 * Central Leave Policy Configuration
 *
 * Single source of truth for all leave rules.
 * Used by leaveController (enforcement), resetLeaveBalances (annual reset),
 * and exposed to the frontend via /api/leaves/policy.
 */

const LEAVE_POLICY = {
  // "Personal Leave" — quota depends on the employee's work_mode:
  //   WFH employees: 8 days/year, unused balance carries forward (max 16)
  //   WFO employees: 12 days/year, resets every year
  // "Claimed Leave" (formerly "Personal Leave") — quota depends on work_mode:
  //   WFH employees: 8 days/year, unused balance carries forward (max 16)
  //   WFO employees: 12 days/year, resets every year
  casual: {
    label:               'Claimed Leave',
    annual_days_wfh:     8,
    annual_days_wfo:     12,
    carry_forward_wfh:   true,
    carry_forward_cap:   16,
    carry_forward_wfo:   false,
    requires_document:   false,
    max_at_once:         null,
    half_day_allowed:    true,   // can be applied as half day with a time window
    description:         'WFH: 8 days/year (carry forward, max 16) · WFO: 12 days/year (resets annually)',
    color:               '#818CF8',
  },
  sick: {
    label:            'Sick Leave',
    annual_days:      12,
    carry_forward:    false,
    requires_document:true,     // ← policy: MUST submit document/note
    max_at_once:      null,
    half_day_allowed: true,     // can be applied as half day with a time window
    description:      '12 days per year. Medical document note is mandatory.',
    color:            '#F472B6',
  },
  long_leave: {
    label:            'Long Leave',
    annual_days:      null,     // HR-allocated, not an annual entitlement
    carry_forward:    false,
    requires_document:false,
    max_at_once:      null,
    description:      'Extended leave. Balance is allocated by HR.',
    color:            '#38BDF8',
  },
  marriage: {
    label:            'Marriage Leave',
    annual_days:      null,     // not an annual entitlement — one-time
    carry_forward:    false,
    requires_document:false,
    max_at_once:      5,        // ← max 5 days per application
    description:      'One-time entitlement of 5 days.',
    color:            '#F9A8D4',
  },
  maternity: {
    label:            'Maternity Leave',
    annual_days:      null,
    carry_forward:    false,
    requires_document:false,
    max_at_once:      90,       // ← max 90 days (3 months)
    description:      'One-time entitlement of up to 90 days (3 months).',
    color:            '#86EFAC',
  },
  comp_off: {
    label:            'Comp Off',
    annual_days:      null,     // earned, not allocated
    carry_forward:    false,
    requires_document:false,
    max_at_once:      null,
    description:      'Earned by working on holidays/weekends. Granted by HR.',
    color:            '#34D399',
  },
  permission: {
    label:            'Permission (Hourly)',
    annual_days:      null,
    carry_forward:    false,
    requires_document:false,
    max_at_once:      null,
    description:      'Short hourly permissions, calculated in fractions of a day.',
    color:            '#94A3B8',
  },
  unpaid: {
    label:            'Unpaid Leave',
    annual_days:      null,
    carry_forward:    false,
    requires_document:false,
    max_at_once:      null,
    description:      'Leave without pay. No balance required.',
    color:            '#64748B',
  },
};

/**
 * Default leave balances when creating a new user.
 * Personal leave (casual) default is for WFO; override to 8 for WFH in userController.
 */
const DEFAULT_BALANCES = {
  casual_leave_balance:   LEAVE_POLICY.casual.annual_days_wfo,  // 12 (WFO default; use 8 for WFH)
  sick_leave_balance:     LEAVE_POLICY.sick.annual_days,         // 12
  marriage_leave_balance: LEAVE_POLICY.marriage.max_at_once,     // 5
  maternity_leave_balance:LEAVE_POLICY.maternity.max_at_once,    // 90
  comp_off_balance:       0,                                     // earned, starts at 0
  long_leave_balance:     0,                                     // HR-allocated, starts at 0
};

/**
 * Compute new balances for annual reset.
 * - Annual leaves: reset to annual_days (or carry forward for WFH)
 * - One-time leaves (marriage, maternity): untouched — HR manages manually
 * - comp_off: untouched — it's earned
 *
 * @param {object} currentUser  — Sequelize User instance (has current balances)
 * @returns {object} updates    — partial update object for user.update()
 */
function computeAnnualReset(currentUser) {
  const updates = {};
  const pol = LEAVE_POLICY.casual;

  // Personal Leave (casual_leave_balance) — depends on work_mode
  if (currentUser.work_mode === 'wfh') {
    // WFH: carry forward unused + 8, capped at 16
    const current = parseFloat(currentUser.casual_leave_balance) || 0;
    updates.casual_leave_balance = Math.min(pol.carry_forward_cap, current + pol.annual_days_wfh);
  } else {
    // WFO (or unset): reset to 12
    updates.casual_leave_balance = pol.annual_days_wfo;
  }

  // Sick leave: always reset to 12/year
  updates.sick_leave_balance = LEAVE_POLICY.sick.annual_days;

  // Marriage, Maternity, Comp Off: untouched (one-time / earned)

  return updates;
}

module.exports = { LEAVE_POLICY, DEFAULT_BALANCES, computeAnnualReset };
