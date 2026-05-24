/**
 * Full demo seed — 2 HR + 2 Leads + 5 Employees
 * Attendance (30 working days), Leaves, Idle Logs
 *
 * Run: node src/config/seed.js
 * Re-run safe: clears seed users first, keeps the HR admin created by migrate.js
 */

require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const sequelize = require('./database');
const { User, Attendance, Leave, IdleLog } = require('../models');

/* ── helpers ─────────────────────────────────────────────────────────── */

const HASH = (pw) => bcrypt.hashSync(pw, 10);

/** Return the last N working days (Mon–Fri) up to and including today */
function lastWorkingDays(n) {
  const days = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (days.length < n) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) days.push(new Date(d));
    d.setDate(d.getDate() - 1);
  }
  return days.reverse();           // oldest → newest
}

/** Build a Date for a given base date + hours + minutes */
function dt(base, h, m = 0) {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Random int between lo and hi inclusive */
function rnd(lo, hi) {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/* ── user definitions ────────────────────────────────────────────────── */

const USERS = [
  /* ── HR ── */
  {
    id: uuidv4(), employee_id: 'EMP0002',
    first_name: 'Priya',    last_name: 'Rajan',
    email: 'priya.hr@company.com', password: HASH('Pass@1234'),
    role: 'hr', department: 'HR', designation: 'HR Manager',
    phone: '9876543201',
    casual_leave_balance: 10, sick_leave_balance: 5, comp_off_balance: 1,
    password_reset_required: false,
  },
  {
    id: uuidv4(), employee_id: 'EMP0003',
    first_name: 'Karthik',  last_name: 'Suresh',
    email: 'karthik.hr@company.com', password: HASH('Pass@1234'),
    role: 'hr', department: 'HR', designation: 'HR Executive',
    phone: '9876543202',
    casual_leave_balance: 11, sick_leave_balance: 6, comp_off_balance: 0,
    password_reset_required: false,
  },

  /* ── Leads ── */
  {
    id: uuidv4(), employee_id: 'EMP0004',
    first_name: 'Vijay',    last_name: 'Kumar',
    email: 'vijay.lead@company.com', password: HASH('Pass@1234'),
    role: 'lead', department: 'Operations', designation: 'Operations Lead',
    phone: '9876543203',
    casual_leave_balance: 9, sick_leave_balance: 4, comp_off_balance: 2,
    password_reset_required: false,
  },
  {
    id: uuidv4(), employee_id: 'EMP0005',
    first_name: 'Deepa',    last_name: 'Nair',
    email: 'deepa.lead@company.com', password: HASH('Pass@1234'),
    role: 'lead', department: 'Quality', designation: 'Quality Lead',
    phone: '9876543204',
    casual_leave_balance: 10, sick_leave_balance: 5, comp_off_balance: 0,
    password_reset_required: false,
  },

  /* ── Employees ── */
  {
    id: uuidv4(), employee_id: 'EMP0006',
    first_name: 'Arun',     last_name: 'Selvam',
    email: 'arun@company.com', password: HASH('Pass@1234'),
    role: 'employee', department: 'Operations', designation: 'Senior Agent',
    phone: '9876543205',
    casual_leave_balance: 8, sick_leave_balance: 3, comp_off_balance: 1,
    password_reset_required: false,
  },
  {
    id: uuidv4(), employee_id: 'EMP0007',
    first_name: 'Meena',    last_name: 'Krishnan',
    email: 'meena@company.com', password: HASH('Pass@1234'),
    role: 'employee', department: 'Operations', designation: 'Agent',
    phone: '9876543206',
    casual_leave_balance: 10, sick_leave_balance: 6, comp_off_balance: 0,
    password_reset_required: false,
  },
  {
    id: uuidv4(), employee_id: 'EMP0008',
    first_name: 'Rajan',    last_name: 'Pillai',
    email: 'rajan@company.com', password: HASH('Pass@1234'),
    role: 'employee', department: 'Quality', designation: 'QA Analyst',
    phone: '9876543207',
    casual_leave_balance: 7, sick_leave_balance: 4, comp_off_balance: 0,
    password_reset_required: false,
  },
  {
    id: uuidv4(), employee_id: 'EMP0009',
    first_name: 'Anitha',   last_name: 'Balan',
    email: 'anitha@company.com', password: HASH('Pass@1234'),
    role: 'employee', department: 'Quality', designation: 'Agent',
    phone: '9876543208',
    casual_leave_balance: 11, sick_leave_balance: 5, comp_off_balance: 0,
    password_reset_required: false,
  },
  {
    id: uuidv4(), employee_id: 'EMP0010',
    first_name: 'Suresh',   last_name: 'Murugan',
    email: 'suresh@company.com', password: HASH('Pass@1234'),
    role: 'employee', department: 'Operations', designation: 'Agent',
    phone: '9876543209',
    casual_leave_balance: 6, sick_leave_balance: 2, comp_off_balance: 3,
    password_reset_required: false,
  },
];

/* ── attendance patterns per user index ─────────────────────────────── */
// For each of the 9 users: array of 30 entries, one per working day
// 'P' = present, 'A' = absent, 'H' = half_day, 'L' = on_leave

const PATTERNS = [
  // HR Priya    (index 0)
  'PPPPPPPPPPHPPPPPPPPPLPPPPPPPHPP',
  // HR Karthik  (index 1)
  'PPPPAPPPPPPPPPPPPHPPPPPLPPPPPPP',
  // Lead Vijay  (index 2)
  'PPPPPPHPPPPPPPPAPLPPPPPPPPPPPPP',
  // Lead Deepa  (index 3)
  'PPPPPPPPPPPPPHPPPPPPPAPPPPLPPPP',
  // Emp Arun    (index 4)
  'PPPPHPPPPPAPPPPLPPPPPPPPPPPHPPP',
  // Emp Meena   (index 5)
  'PPPPPPAPPPPPPLPPPPPHPPPPPPPPPAP',
  // Emp Rajan   (index 6)
  'PPPPPPPPAPPPPPPHPPPLPPPPPPPPAPP',
  // Emp Anitha  (index 7)
  'PPPPLLPPPPPPPPPAPPPPPPPPHPPPPPP',
  // Emp Suresh  (index 8)
  'PPHPPPPPPPAPPPPPPLPPPPPPPPPPPAP',
];

/* ── leave definitions ───────────────────────────────────────────────── */
// We'll resolve user IDs after creating users
// format: { userIndex, reviewerIndex, type, start, end, duration, reason, status, comment }

const today     = new Date(); today.setHours(0, 0, 0, 0);
const daysAgo   = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; };
const daysAhead = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]; };

const LEAVE_DEFS = [
  // Approved leaves (tied to 'L' days in patterns)
  {
    userIdx: 0, reviewerIdx: 1, type: 'casual',
    start: daysAgo(8), end: daysAgo(8), duration: 1,
    reason: 'Personal work at home town', status: 'approved',
    comment: 'Approved. Enjoy your time off.',
  },
  {
    userIdx: 1, reviewerIdx: 0, type: 'sick',
    start: daysAgo(5), end: daysAgo(5), duration: 1,
    reason: 'Fever and mild cold', status: 'approved',
    comment: 'Get well soon.',
  },
  {
    userIdx: 2, reviewerIdx: 0, type: 'casual',
    start: daysAgo(12), end: daysAgo(12), duration: 1,
    reason: 'Family function', status: 'approved',
    comment: 'Approved.',
  },
  {
    userIdx: 3, reviewerIdx: 1, type: 'casual',
    start: daysAgo(7), end: daysAgo(7), duration: 1,
    reason: 'Medical appointment', status: 'approved',
    comment: 'Approved.',
  },
  {
    userIdx: 4, reviewerIdx: 2, type: 'casual',
    start: daysAgo(14), end: daysAgo(14), duration: 1,
    reason: 'Personal errand', status: 'approved',
    comment: 'Approved by team lead.',
  },
  {
    userIdx: 5, reviewerIdx: 2, type: 'sick',
    start: daysAgo(11), end: daysAgo(11), duration: 1,
    reason: 'Stomach infection', status: 'approved',
    comment: 'Take care and rest.',
  },
  {
    userIdx: 6, reviewerIdx: 3, type: 'casual',
    start: daysAgo(10), end: daysAgo(10), duration: 1,
    reason: 'House shifting', status: 'approved',
    comment: 'Approved.',
  },
  {
    userIdx: 7, reviewerIdx: 3, type: 'casual',
    start: daysAgo(20), end: daysAgo(19), duration: 2,
    reason: 'Marriage ceremony at native', status: 'approved',
    comment: 'Approved. Have a great time!',
  },
  {
    userIdx: 8, reviewerIdx: 2, type: 'comp_off',
    start: daysAgo(6), end: daysAgo(6), duration: 1,
    reason: 'Compensating weekend overtime on 10th', status: 'approved',
    comment: 'Approved. Well deserved.',
  },

  // Rejected leaves
  {
    userIdx: 4, reviewerIdx: 2, type: 'casual',
    start: daysAgo(3), end: daysAgo(2), duration: 2,
    reason: 'Going on trip with friends', status: 'rejected',
    comment: 'Insufficient notice period. Please reapply with 3 days notice.',
  },
  {
    userIdx: 6, reviewerIdx: 3, type: 'unpaid',
    start: daysAgo(25), end: daysAgo(23), duration: 3,
    reason: 'Extended personal travel', status: 'rejected',
    comment: 'Cannot accommodate for this period. Discuss with HR.',
  },

  // Pending leaves (future dates)
  {
    userIdx: 5, reviewerIdx: null, type: 'casual',
    start: daysAhead(3), end: daysAhead(4), duration: 2,
    reason: 'Parents visiting, need to be home', status: 'pending',
    comment: null,
  },
  {
    userIdx: 7, reviewerIdx: null, type: 'sick',
    start: daysAhead(1), end: daysAhead(1), duration: 1,
    reason: 'Scheduled dental surgery', status: 'pending',
    comment: null,
  },
  {
    userIdx: 8, reviewerIdx: null, type: 'permission',
    start: daysAhead(2), end: daysAhead(2), duration: 0.25,
    reason: 'Bank work — 2 hours', status: 'pending',
    comment: null,
    start_time: '10:00', end_time: '12:00',
  },
  {
    userIdx: 6, reviewerIdx: null, type: 'casual',
    start: daysAhead(5), end: daysAhead(6), duration: 2,
    reason: 'Festival celebration at home', status: 'pending',
    comment: null,
  },
  {
    userIdx: 4, reviewerIdx: null, type: 'comp_off',
    start: daysAhead(4), end: daysAhead(4), duration: 1,
    reason: 'Comp off for working last Sunday', status: 'pending',
    comment: null,
  },
];

/* ── idle log definitions ────────────────────────────────────────────── */
// Generate for last 5 working days, for employees only (indices 4–8)

function buildIdleLogs(users, workingDays) {
  const logs = [];
  const empUsers = users.slice(4); // indices 4-8

  const last5 = workingDays.slice(-5);

  const idleProfile = [
    // [minEvents, maxEvents, minIdle, maxIdle (seconds per event)]
    [2, 5,  120, 600],   // Arun   — moderate
    [1, 3,  60,  300],   // Meena  — low
    [3, 7,  300, 1200],  // Rajan  — high (often flagged)
    [1, 4,  90,  500],   // Anitha — moderate
    [4, 8,  600, 1800],  // Suresh — very high (flagged)
  ];

  for (let ui = 0; ui < empUsers.length; ui++) {
    const user = empUsers[ui];
    const [minEv, maxEv, minSec, maxSec] = idleProfile[ui];

    for (const day of last5) {
      const events = rnd(minEv, maxEv);
      let startHour = 9;

      for (let e = 0; e < events; e++) {
        const idleSec = rnd(minSec, maxSec);
        const idleStart = dt(day, startHour + rnd(0, 1), rnd(5, 55));
        const idleEnd   = new Date(idleStart.getTime() + idleSec * 1000);

        logs.push({
          id:           uuidv4(),
          user_id:      user.id,
          date:         day.toISOString().split('T')[0],
          idle_start:   idleStart,
          idle_end:     idleEnd,
          idle_seconds: idleSec,
          machine_name: `DESK-${user.employee_id}`,
          agent_version: '1.0.0',
        });
        startHour += rnd(1, 2);
        if (startHour >= 17) break;
      }
    }
  }
  return logs;
}

/* ── main ────────────────────────────────────────────────────────────── */

async function run() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });

  /* 1. Remove previously seeded demo users (keep the migrate.js admin) */
  const seedEmails = USERS.map((u) => u.email);
  await User.destroy({ where: { email: seedEmails } });
  console.log('Cleared previous seed users');

  /* 2. Create users (bypassing hooks — passwords already hashed) */
  const created = await User.bulkCreate(USERS, {
    individualHooks: false,   // skip bcrypt hooks — we pre-hashed
    ignoreDuplicates: false,
  });
  console.log(`Created ${created.length} users`);

  /* 3. Assign manager_id: employees → leads, leads → HR Priya */
  const [priya, , vijay, deepa, arun, meena, , , suresh] = created;
  await User.update({ manager_id: priya.id }, { where: { employee_id: ['EMP0004', 'EMP0005'] } });
  await User.update({ manager_id: vijay.id }, { where: { employee_id: ['EMP0006', 'EMP0007', 'EMP0010'] } });
  await User.update({ manager_id: deepa.id }, { where: { employee_id: ['EMP0008', 'EMP0009'] } });
  console.log('Manager relationships set');

  /* 4. Build attendance records */
  const workingDays = lastWorkingDays(30);
  const attendanceRows = [];

  for (let ui = 0; ui < created.length; ui++) {
    const user    = created[ui];
    const pattern = PATTERNS[ui] || 'P'.repeat(30);

    for (let di = 0; di < workingDays.length; di++) {
      const day    = workingDays[di];
      const code   = (pattern[di] || 'P').toUpperCase();
      const dateStr = day.toISOString().split('T')[0];

      let row = {
        id:      uuidv4(),
        user_id: user.id,
        date:    dateStr,
        status:  'absent',
        login_time:  null,
        logout_time: null,
        total_hours: null,
      };

      if (code === 'P') {
        const inH  = 9,  inM  = rnd(0, 20);
        const outH = 18, outM = rnd(0, 30);
        const login  = dt(day, inH, inM);
        const logout = dt(day, outH, outM);
        row.login_time  = login;
        row.logout_time = logout;
        row.total_hours = parseFloat(((logout - login) / 3600000).toFixed(2));
        row.status = 'present';

      } else if (code === 'H') {
        const login  = dt(day, 9, rnd(0, 15));
        const logout = dt(day, 13, rnd(0, 30));
        row.login_time  = login;
        row.logout_time = logout;
        row.total_hours = parseFloat(((logout - login) / 3600000).toFixed(2));
        row.status = 'half_day';

      } else if (code === 'L') {
        row.status = 'on_leave';

      } else {
        row.status = 'absent';
      }

      attendanceRows.push(row);
    }
  }

  await Attendance.destroy({ where: { user_id: created.map((u) => u.id) } });
  await Attendance.bulkCreate(attendanceRows, { individualHooks: false });
  console.log(`Created ${attendanceRows.length} attendance records`);

  /* 5. Build leave records */
  const leaveRows = LEAVE_DEFS.map((def) => {
    const user     = created[def.userIdx];
    const reviewer = def.reviewerIdx != null ? created[def.reviewerIdx] : null;
    return {
      id:               uuidv4(),
      user_id:          user.id,
      reviewed_by:      reviewer?.id ?? null,
      type:             def.type,
      start_date:       def.start,
      end_date:         def.end,
      start_time:       def.start_time ?? null,
      end_time:         def.end_time   ?? null,
      duration_days:    def.duration,
      reason:           def.reason,
      status:           def.status,
      reviewer_comment: def.comment  ?? null,
      reviewed_at:      def.status !== 'pending' ? new Date() : null,
    };
  });

  await Leave.destroy({ where: { user_id: created.map((u) => u.id) } });
  await Leave.bulkCreate(leaveRows, { individualHooks: false });
  console.log(`Created ${leaveRows.length} leave records`);

  /* 6. Build idle logs */
  const idleLogs = buildIdleLogs(created, workingDays);
  await IdleLog.destroy({ where: { user_id: created.map((u) => u.id) } });
  await IdleLog.bulkCreate(idleLogs, { individualHooks: false });
  console.log(`Created ${idleLogs.length} idle log records`);

  /* 7. Summary */
  console.log('\n─────────────────────────────────────────');
  console.log('  Seed complete! Login credentials:');
  console.log('─────────────────────────────────────────');
  console.log('  Role       Email                        Password');
  console.log('  HR Admin   admin@company.com            Admin@2025!  (existing)');
  console.log('  HR         priya.hr@company.com         Pass@1234');
  console.log('  HR         karthik.hr@company.com       Pass@1234');
  console.log('  Lead       vijay.lead@company.com       Pass@1234');
  console.log('  Lead       deepa.lead@company.com       Pass@1234');
  console.log('  Employee   arun@company.com             Pass@1234');
  console.log('  Employee   meena@company.com            Pass@1234');
  console.log('  Employee   rajan@company.com            Pass@1234');
  console.log('  Employee   anitha@company.com           Pass@1234');
  console.log('  Employee   suresh@company.com           Pass@1234');
  console.log('─────────────────────────────────────────\n');

  await sequelize.close();
}

run().catch((err) => { console.error(err); process.exit(1); });
