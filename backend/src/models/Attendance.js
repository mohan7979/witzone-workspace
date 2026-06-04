const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Attendance = sequelize.define('Attendance', {
  id:      { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id: { type: DataTypes.UUID, allowNull: false },
  date:    { type: DataTypes.DATEONLY, allowNull: false },

  /* ── Session 1 ─────────────────────────────────────────────── */
  login_time:  { type: DataTypes.DATE },
  logout_time: { type: DataTypes.DATE },

  /* ── Session 2 (optional second shift) ─────────────────────── */
  login_time_2:  { type: DataTypes.DATE },
  logout_time_2: { type: DataTypes.DATE },

  /* ── Break tracking ─────────────────────────────────────────── */
  on_break:            { type: DataTypes.BOOLEAN,  defaultValue: false },
  break_start:         { type: DataTypes.DATE },               // current break start (null when not on break)
  total_break_seconds: { type: DataTypes.INTEGER,  defaultValue: 0 },  // accumulated break time

  /* ── Computed totals ────────────────────────────────────────── */
  total_hours:     { type: DataTypes.DECIMAL(5, 2) }, // sum of both sessions
  idle_seconds:    { type: DataTypes.INTEGER, defaultValue: 0 },
  effective_hours: { type: DataTypes.DECIMAL(5, 2) },

  status: {
    type: DataTypes.ENUM('present', 'absent', 'half_day', 'on_leave', 'holiday'),
    defaultValue: 'absent',
  },

  login_ip:  { type: DataTypes.STRING(45) },
  logout_ip: { type: DataTypes.STRING(45) },
  notes:     { type: DataTypes.TEXT },
}, {
  indexes: [{ unique: true, fields: ['user_id', 'date'] }],
});

module.exports = Attendance;
