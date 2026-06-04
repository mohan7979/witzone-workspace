const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Leave = sequelize.define('Leave', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id: { type: DataTypes.UUID, allowNull: false },

  // HR final reviewer
  reviewed_by:      { type: DataTypes.UUID },
  reviewer_comment: { type: DataTypes.TEXT },
  reviewed_at:      { type: DataTypes.DATE },

  // TL (Level-1) reviewer
  tl_reviewed_by: { type: DataTypes.UUID },
  tl_status:      { type: DataTypes.ENUM('approved', 'rejected'), allowNull: true },
  tl_comment:     { type: DataTypes.TEXT },
  tl_reviewed_at: { type: DataTypes.DATE },
  // True when the employee has no assigned TL, so the TL stage is bypassed and
  // the request goes straight to HR. Kept separate from tl_status so the UI never
  // shows a false "TL Approved" for a review that never happened.
  tl_skipped:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

  type: {
    type: DataTypes.ENUM(
      'casual', 'sick', 'comp_off', 'permission', 'unpaid',
      'marriage', 'maternity', 'long_leave'
    ),
    allowNull: false,
  },

  start_date:    { type: DataTypes.DATEONLY, allowNull: false },
  end_date:      { type: DataTypes.DATEONLY, allowNull: false },
  start_time:    { type: DataTypes.TIME },
  end_time:      { type: DataTypes.TIME },
  // Half-day leave: a single date counted as 0.5 days, with the time window
  // captured in start_time / end_time.
  is_half_day:   { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  duration_days: { type: DataTypes.DECIMAL(4, 1), allowNull: false },
  reason:        { type: DataTypes.TEXT, allowNull: false },
  document_note: { type: DataTypes.TEXT },          // optional note for sick leave
  document_file: { type: DataTypes.STRING(255) },   // uploaded medical certificate filename

  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'),
    defaultValue: 'pending',
  },
});

module.exports = Leave;
