const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ShiftTemplate = sequelize.define('ShiftTemplate', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name:       { type: DataTypes.STRING(100), allowNull: false },
  shift_type: {
    type: DataTypes.ENUM('day', 'night'),
    allowNull: false,
    defaultValue: 'day',
  },
  start_time: { type: DataTypes.TIME, allowNull: false },
  end_time:   { type: DataTypes.TIME, allowNull: false },
  /* Night shifts cross midnight (end_time < start_time) — stored explicitly */
  crosses_midnight: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_active:  { type: DataTypes.BOOLEAN, defaultValue: true },
});

module.exports = ShiftTemplate;
