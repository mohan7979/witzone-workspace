const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Designation = sequelize.define('Designation', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  name:       { type: DataTypes.STRING(100), allowNull: false },
  department: { type: DataTypes.STRING(100) },
  is_active:  { type: DataTypes.BOOLEAN, defaultValue: true },
});

module.exports = Designation;
