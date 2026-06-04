require('dotenv').config();
const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, User, Leave } = require('../models');

// Generates a strong, human-typable temporary password (reset required on login).
function genPassword() {
  // e.g. "Witz-7Q4M-x9Kt" — mixed case, digits, no ambiguous separators
  const seg = () => crypto.randomBytes(3).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4);
  return `Su-${seg()}-${seg()}`;
}

// Idempotently ensure the two Superuser accounts exist.
async function ensureSuperusers() {
  const SUPERUSERS = [
    { employee_id: 'SU0001', first_name: 'Super', last_name: 'User One', email: 'super1@witzone.com' },
    { employee_id: 'SU0002', first_name: 'Super', last_name: 'User Two', email: 'super2@witzone.com' },
  ];

  for (const su of SUPERUSERS) {
    const exists = await User.findOne({ where: { email: su.email } });
    if (exists) {
      console.log(`Superuser already exists: ${su.email}`);
      continue;
    }
    const password = genPassword();
    await User.create({
      ...su,
      password,                       // hashed by the model's beforeCreate hook
      role: 'superuser',
      department: 'Administration',
      designation: 'Superuser',
      status: 'active',
      password_reset_required: true,
    });
    console.log('Superuser created:');
    console.log(`  Email:    ${su.email}`);
    console.log(`  Password: ${password}  (change on first login)`);
  }
}

async function seed() {
  await sequelize.sync({ force: false, alter: true });

  // One-time backfill: legacy leaves for employees with no TL were auto-stamped
  // tl_status='approved' (without a real reviewer), which made the UI show a false
  // "TL Approved". A genuine TL review always sets tl_reviewed_by, so any approved
  // tl_status with a NULL reviewer is a skip — convert it to the explicit flag.
  const [, fixed] = await Leave.update(
    { tl_skipped: true, tl_status: null },
    { where: { tl_status: 'approved', tl_reviewed_by: { [Op.is]: null } } }
  );
  console.log(`Leave workflow backfill: corrected ${fixed ?? 0} legacy TL-skip record(s).`);

  // Always ensure the two Superuser accounts (independent of HR seeding).
  await ensureSuperusers();

  const existing = await User.findOne({ where: { role: 'hr' } });
  if (existing) {
    console.log('HR admin already exists:', existing.email);
    process.exit(0);
  }

  await User.create({
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
