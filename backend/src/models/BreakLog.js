const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * One row per break the employee takes. break_end IS NULL while the break is
 * ongoing. Gives HR an exact Break In / Break Out trail (the Attendance table
 * only keeps an accumulated total + the current break start).
 */
const BreakLog = sequelize.define('BreakLog', {
  id:      { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id: { type: DataTypes.UUID, allowNull: false },
  date:    { type: DataTypes.DATEONLY, allowNull: false },

  break_start:      { type: DataTypes.DATE, allowNull: false },  // Break In
  break_end:        { type: DataTypes.DATE },                    // Break Out (null = ongoing)
  duration_seconds: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'break_logs',
  indexes: [{ fields: ['user_id', 'date'] }],
});

module.exports = BreakLog;
