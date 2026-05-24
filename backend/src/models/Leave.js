const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Leave = sequelize.define('Leave', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id: { type: DataTypes.UUID, allowNull: false },
  reviewed_by: { type: DataTypes.UUID },
  type: {
    type: DataTypes.ENUM('casual', 'sick', 'comp_off', 'permission', 'unpaid'),
    allowNull: false,
  },
  start_date: { type: DataTypes.DATEONLY, allowNull: false },
  end_date: { type: DataTypes.DATEONLY, allowNull: false },
  // For permission: start_time and end_time (same day, partial hours)
  start_time: { type: DataTypes.TIME },
  end_time: { type: DataTypes.TIME },
  duration_days: { type: DataTypes.DECIMAL(4, 1), allowNull: false },
  reason: { type: DataTypes.TEXT, allowNull: false },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'cancelled'),
    defaultValue: 'pending',
  },
  reviewer_comment: { type: DataTypes.TEXT },
  reviewed_at: { type: DataTypes.DATE },
});

module.exports = Leave;
