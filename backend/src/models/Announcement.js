const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Announcement = sequelize.define('Announcement', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title:      { type: DataTypes.STRING(200), allowNull: false },
  body:       { type: DataTypes.TEXT },
  is_pinned:  { type: DataTypes.BOOLEAN, defaultValue: false },
  created_by: { type: DataTypes.UUID, allowNull: false },
});

module.exports = Announcement;
