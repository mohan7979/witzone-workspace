require('dotenv').config();
const { sequelize, User } = require('../models');
const bcrypt = require('bcryptjs');

async function seed() {
  await sequelize.sync({ force: false, alter: true });

  const existing = await User.findOne({ where: { role: 'hr' } });
  if (existing) {
    console.log('HR admin already exists:', existing.email);
    process.exit(0);
  }

  const admin = await User.create({
    employee_id: 'EMP0001',
    first_name: 'HR',
    last_name: 'Admin',
    email: 'admin@company.com',
    password: 'Admin@123',
    role: 'hr',
    department: 'HR',
    designation: 'HR Manager',
    status: 'active',
    password_reset_required: true,
  });

  console.log('HR admin created:');
  console.log('  Email:    admin@company.com');
  console.log('  Password: Admin@123  (change on first login)');
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
