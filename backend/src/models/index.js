const sequelize    = require('../config/database');
const User         = require('./User');
const Attendance   = require('./Attendance');
const Leave        = require('./Leave');
const IdleLog      = require('./IdleLog');
const Department   = require('./Department');
const Designation  = require('./Designation');
const Holiday      = require('./Holiday');
const ShiftTemplate = require('./ShiftTemplate');
const Announcement = require('./Announcement');

// ── Core associations ──────────────────────────────────────────────
User.hasMany(Attendance, { foreignKey: 'user_id', as: 'attendances' });
Attendance.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Leave, { foreignKey: 'user_id', as: 'leaves' });
Leave.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Leave.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });

User.hasMany(IdleLog, { foreignKey: 'user_id', as: 'idleLogs' });
IdleLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.belongsTo(User, { foreignKey: 'manager_id', as: 'manager' });
User.hasMany(User,  { foreignKey: 'manager_id', as: 'team' });

// ── Announcement author ────────────────────────────────────────────
Announcement.belongsTo(User, { foreignKey: 'created_by', as: 'author' });

module.exports = {
  sequelize,
  User,
  Attendance,
  Leave,
  IdleLog,
  Department,
  Designation,
  Holiday,
  ShiftTemplate,
  Announcement,
};
