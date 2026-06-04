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
  role:        { type: DataTypes.ENUM('employee', 'lead', 'hr', 'superuser'), defaultValue: 'employee' },
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

  // ── Employee Master Data (Personal Details form) ──────────────────────────
  // Personal information
  blood_group:    { type: DataTypes.STRING(5) },
  qualification:  { type: DataTypes.STRING(150) },
  marital_status: { type: DataTypes.ENUM('single', 'married'), allowNull: true },
  spouse_name:    { type: DataTypes.STRING(100) },
  // Contact information (phone = primary mobile / "mobile_1")
  mobile_2:       { type: DataTypes.STRING(15) },
  personal_email: { type: DataTypes.STRING(120) },   // separate from login email
  // Address information
  present_address:   { type: DataTypes.TEXT },
  permanent_address: { type: DataTypes.TEXT },
  aadhaar_address:   { type: DataTypes.TEXT },
  // Family
  father_name:    { type: DataTypes.STRING(100) },
  father_mobile:  { type: DataTypes.STRING(15) },
  mother_name:    { type: DataTypes.STRING(100) },
  mother_mobile:  { type: DataTypes.STRING(15) },
  sibling_details:{ type: DataTypes.TEXT },          // names & contact numbers (free text)
  // Emergency contacts
  emergency_contact_1_name:         { type: DataTypes.STRING(100) },
  emergency_contact_1_relationship: { type: DataTypes.STRING(50) },
  emergency_contact_1_number:       { type: DataTypes.STRING(15) },
  emergency_contact_2_name:         { type: DataTypes.STRING(100) },
  emergency_contact_2_relationship: { type: DataTypes.STRING(50) },
  emergency_contact_2_number:       { type: DataTypes.STRING(15) },
  // Government IDs (sensitive)
  aadhaar_name:   { type: DataTypes.STRING(100) },
  aadhaar_number: { type: DataTypes.STRING(20) },
  pan_number:     { type: DataTypes.STRING(15) },
  // Banking details (sensitive)
  bank_account_number: { type: DataTypes.STRING(30) },
  bank_ifsc:           { type: DataTypes.STRING(15) },

  status:    { type: DataTypes.ENUM('active', 'inactive', 'suspended'), defaultValue: 'active' },
  work_mode: { type: DataTypes.ENUM('wfh', 'wfo'), defaultValue: 'wfo' }, // WFH=8d/yr carry-fwd, WFO=12d/yr reset

  // Leave balances — defaults from central policy (leavePolicy.js)
  // casual = "Personal Leave": 8 days for WFH (carry-forward), 12 days for WFO (resets)
  casual_leave_balance:   { type: DataTypes.DECIMAL(4, 1), defaultValue: 12.0 },
  sick_leave_balance:     { type: DataTypes.DECIMAL(4, 1), defaultValue: 12.0 },  // 12/yr, doc required
  comp_off_balance:       { type: DataTypes.DECIMAL(4, 1), defaultValue:  0.0 },  // earned, granted by HR
  marriage_leave_balance: { type: DataTypes.DECIMAL(4, 1), defaultValue:  5.0 },  // one-time 5d
  maternity_leave_balance:{ type: DataTypes.DECIMAL(4, 1), defaultValue: 90.0 },  // one-time 90d

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
