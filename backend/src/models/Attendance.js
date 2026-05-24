const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Attendance = sequelize.define('Attendance', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id: { type: DataTypes.UUID, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  login_time: { type: DataTypes.DATE },
  logout_time: { type: DataTypes.DATE },
  total_hours: { type: DataTypes.DECIMAL(4, 2) },
  status: {
    type: DataTypes.ENUM('present', 'absent', 'half_day', 'on_leave', 'holiday'),
    defaultValue: 'absent',
  },
  idle_seconds: { type: DataTypes.INTEGER, defaultValue: 0 },
  effective_hours: { type: DataTypes.DECIMAL(4, 2) },
  login_ip: { type: DataTypes.STRING(45) },
  logout_ip: { type: DataTypes.STRING(45) },
  notes: { type: DataTypes.TEXT },
}, {
  indexes: [{ unique: true, fields: ['user_id', 'date'] }],
});

module.exports = Attendance;
