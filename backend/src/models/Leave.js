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

  type: {
    type: DataTypes.ENUM(
      'casual', 'sick', 'comp_off', 'permission', 'unpaid',
      'wfh', 'wfo', 'marriage', 'maternity'
    ),
    allowNull: false,
  },

  start_date:    { type: DataTypes.DATEONLY, allowNull: false },
  end_date:      { type: DataTypes.DATEONLY, allowNull: false },
  start_time:    { type: DataTypes.TIME },
  end_time:      { type: DataTypes.TIME },
  duration_days: { type: DataTypes.DECIMAL(4, 1), allowNull: false },
  reason:        { type: DataTypes.TEXT, allowNull: false },
  document_note: { type: DataTypes.TEXT },   // for sick leave

  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'),
    defaultValue: 'pending',
  },
});

module.exports = Leave;
