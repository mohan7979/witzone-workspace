const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ShiftTemplate = sequelize.define('ShiftTemplate', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name:       { type: DataTypes.STRING(100), allowNull: false },
  start_time: { type: DataTypes.TIME, allowNull: false },
  end_time:   { type: DataTypes.TIME, allowNull: false },
  is_active:  { type: DataTypes.BOOLEAN, defaultValue: true },
});

module.exports = ShiftTemplate;
