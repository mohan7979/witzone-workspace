const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const IdleLog = sequelize.define('IdleLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id: { type: DataTypes.UUID, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  // Epoch timestamps from desktop agent
  idle_start: { type: DataTypes.DATE, allowNull: false },
  idle_end: { type: DataTypes.DATE },
  idle_seconds: { type: DataTypes.INTEGER, defaultValue: 0 },
  // Agent heartbeat metadata
  agent_version: { type: DataTypes.STRING(10) },
  machine_name: { type: DataTypes.STRING(100) },
});

module.exports = IdleLog;
