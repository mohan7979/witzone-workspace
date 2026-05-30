const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  employee_id: { type: DataTypes.STRING(20), unique: true, allowNull: false },
  first_name:  { type: DataTypes.STRING(50), allowNull: false },
  last_name:   { type: DataTypes.STRING(50), allowNull: false },
  email:       { type: DataTypes.STRING(100), unique: true, allowNull: false },
  password:    { type: DataTypes.STRING(255), allowNull: false },
  role:        { type: DataTypes.ENUM('employee', 'lead', 'hr'), defaultValue: 'employee' },
  department:  { type: DataTypes.STRING(100) },
  designation: { type: DataTypes.STRING(100) },
  phone:       { type: DataTypes.STRING(15) },

  // Shift — either linked to a ShiftTemplate OR raw times (legacy)
  shift_id:    { type: DataTypes.UUID, allowNull: true },
  shift_start: { type: DataTypes.TIME, defaultValue: '09:00:00' },
  shift_end:   { type: DataTypes.TIME, defaultValue: '18:00:00' },

  // Profile
  dob: { type: DataTypes.DATEONLY, allowNull: true },
  doj: { type: DataTypes.DATEONLY, allowNull: true },

  status: { type: DataTypes.ENUM('active', 'inactive', 'suspended'), defaultValue: 'active' },

  // Leave balances
  casual_leave_balance:   { type: DataTypes.DECIMAL(4, 1), defaultValue: 12.0 },
  sick_leave_balance:     { type: DataTypes.DECIMAL(4, 1), defaultValue: 6.0 },
  comp_off_balance:       { type: DataTypes.DECIMAL(4, 1), defaultValue: 0.0 },
  wfh_leave_balance:      { type: DataTypes.DECIMAL(4, 1), defaultValue: 8.0 },
  wfo_leave_balance:      { type: DataTypes.DECIMAL(4, 1), defaultValue: 12.0 },
  marriage_leave_balance: { type: DataTypes.DECIMAL(4, 1), defaultValue: 5.0 },
  maternity_leave_balance:{ type: DataTypes.DECIMAL(4, 1), defaultValue: 90.0 },

  last_login:              { type: DataTypes.DATE },
  last_heartbeat:          { type: DataTypes.DATE },
  last_idle_seconds:       { type: DataTypes.INTEGER, defaultValue: 0 },
  password_reset_required: { type: DataTypes.BOOLEAN, defaultValue: true },
  manager_id:              { type: DataTypes.UUID, allowNull: true },
  terminated_at:           { type: DataTypes.DATE, allowNull: true },
}, {
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) user.password = await bcrypt.hash(user.password, 12);
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) user.password = await bcrypt.hash(user.password, 12);
    },
  },
});

User.prototype.validatePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  return values;
};

module.exports = User;
