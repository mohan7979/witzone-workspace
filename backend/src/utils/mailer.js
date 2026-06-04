const nodemailer = require('nodemailer');
const { LEAVE_POLICY } = require('./leavePolicy');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const send = (to, subject, html) =>
  transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });

// Human-friendly leave type label (e.g. "Claimed Leave" not "casual")
const typeLabel = (leave) => LEAVE_POLICY[leave.type]?.label || (leave.type || '').replace(/_/g, ' ');

// Human-friendly duration: permission → hours, half-day → "Half Day", else days.
const durationLabel = (leave) => {
  if (leave.type === 'permission' && leave.start_time && leave.end_time) {
    const [sh, sm] = leave.start_time.split(':').map(Number);
    const [eh, em] = leave.end_time.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    const h = Math.floor(mins / 60), m = mins % 60;
    return m ? `${h}h ${m}m` : `${h} hour${h === 1 ? '' : 's'}`;
  }
  if (leave.is_half_day) {
    const win = leave.start_time && leave.end_time ? ` (${leave.start_time.slice(0,5)}–${leave.end_time.slice(0,5)})` : '';
    return `Half Day${win}`;
  }
  const d = parseFloat(leave.duration_days);
  return `${d} day${d === 1 ? '' : 's'}`;
};

// When/who a request was raised — for "created date / created by" visibility.
const appliedLine = (employee, leave) => {
  const when = leave.created_at ? new Date(leave.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }) : '';
  return `${employee.first_name} ${employee.last_name}${when ? ` on ${when} IST` : ''}`;
};

const baseStyle = `
  font-family: 'Segoe UI', Arial, sans-serif;
  background: #f4f6f9; padding: 32px;
`;
const cardStyle = `
  background: white; border-radius: 12px; padding: 28px 32px;
  max-width: 520px; margin: 0 auto;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
`;

exports.sendWelcomeEmail = (email, name, employeeId, tempPassword) =>
  send(email, 'Welcome to Witzone Workspace — Your Credentials', `
    <div style="${baseStyle}">
      <div style="${cardStyle}">
        <h2 style="color:#1e293b;margin-top:0">Welcome, ${name}! 👋</h2>
        <p style="color:#475569">Your Witzone Workspace account has been created.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Employee ID</td><td style="font-weight:600;color:#1e293b">${employeeId}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Email</td><td style="font-weight:600;color:#1e293b">${email}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Temp Password</td><td><code style="background:#f1f5f9;padding:4px 10px;border-radius:6px;font-size:14px;color:#6366f1">${tempPassword}</code></td></tr>
        </table>
        <p style="color:#ef4444;font-size:13px">⚠️ Please log in and change your password immediately.</p>
      </div>
    </div>
  `);

exports.sendPasswordResetEmail = (email, name, tempPassword) =>
  send(email, 'Witzone Workspace — Password Reset', `
    <div style="${baseStyle}">
      <div style="${cardStyle}">
        <h2 style="color:#1e293b;margin-top:0">Password Reset</h2>
        <p style="color:#475569">Hello <strong>${name}</strong>, your password has been reset by an administrator.</p>
        <p style="color:#475569">New Temporary Password: <code style="background:#f1f5f9;padding:4px 10px;border-radius:6px;color:#6366f1">${tempPassword}</code></p>
        <p style="color:#ef4444;font-size:13px">⚠️ Please log in and change your password immediately.</p>
      </div>
    </div>
  `);

// Notify TL when employee applies for leave
exports.sendTlNotificationEmail = (tlEmail, employee, leave) =>
  send(tlEmail,
    `Leave Request Pending Your Approval — ${employee.first_name} ${employee.last_name}`,
    `<div style="${baseStyle}"><div style="${cardStyle}">
      <h2 style="color:#1e293b;margin-top:0">📋 Leave Approval Required</h2>
      <p style="color:#475569"><strong>${employee.first_name} ${employee.last_name}</strong> has applied for leave and requires your approval.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px;width:110px">Leave Type</td><td style="font-weight:600;color:#1e293b">${typeLabel(leave)}</td></tr>
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px">From</td><td style="font-weight:600;color:#1e293b">${leave.start_date}</td></tr>
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px">To</td><td style="font-weight:600;color:#1e293b">${leave.end_date}</td></tr>
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px">Duration</td><td style="font-weight:600;color:#1e293b">${durationLabel(leave)}</td></tr>
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px">Requested</td><td style="color:#334155">${appliedLine(employee, leave)}</td></tr>
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px;vertical-align:top">Reason</td><td style="color:#334155">${leave.reason}</td></tr>
        ${leave.document_note ? `<tr><td style="padding:7px 0;color:#94a3b8;font-size:13px;vertical-align:top">Document Note</td><td style="color:#334155">${leave.document_note}</td></tr>` : ''}
      </table>
      <p style="color:#64748b;font-size:13px">Please login to <strong>Witzone Workspace</strong> to approve or reject this request.</p>
    </div></div>`
  );

// Notify the final approver (HR or Superuser) — ready for final decision
exports.sendHrNotificationEmail = (hrEmail, employee, leave, tlName) =>
  send(hrEmail,
    `Leave Awaiting Final Approval (${employee.first_name} ${employee.last_name})`,
    `<div style="${baseStyle}"><div style="${cardStyle}">
      <h2 style="color:#1e293b;margin-top:0">✅ Final Review Needed</h2>
      <p style="color:#475569">Team Lead <strong>${tlName}</strong> review: the following leave needs your final decision.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px;width:110px">Employee</td><td style="font-weight:600;color:#1e293b">${employee.first_name} ${employee.last_name}</td></tr>
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px">Leave Type</td><td style="font-weight:600;color:#1e293b">${typeLabel(leave)}</td></tr>
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px">From</td><td style="font-weight:600;color:#1e293b">${leave.start_date}</td></tr>
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px">To</td><td style="font-weight:600;color:#1e293b">${leave.end_date}</td></tr>
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px">Duration</td><td style="font-weight:600;color:#1e293b">${durationLabel(leave)}</td></tr>
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px">Requested</td><td style="color:#334155">${appliedLine(employee, leave)}</td></tr>
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px;vertical-align:top">Reason</td><td style="color:#334155">${leave.reason}</td></tr>
        ${leave.tl_comment ? `<tr><td style="padding:7px 0;color:#94a3b8;font-size:13px;vertical-align:top">TL Comment</td><td style="color:#334155">${leave.tl_comment}</td></tr>` : ''}
      </table>
      <p style="color:#64748b;font-size:13px">Please login to <strong>Witzone Workspace</strong> to give the final approval or rejection.</p>
    </div></div>`
  );

// Notify employee of any status update
exports.sendLeaveNotificationEmail = (email, employee, leave, action) => {
  const span = `<strong>${typeLabel(leave)}</strong> (${durationLabel(leave)}) from <strong>${leave.start_date}</strong> to <strong>${leave.end_date}</strong>`;
  const configs = {
    approved: {
      subject: '✅ Your Leave Request has been Approved',
      color: '#10b981',
      title: 'Leave Approved',
      body: `Your ${span} has been <span style="color:#10b981;font-weight:700">approved</span>.`,
      extra: leave.reviewer_comment ? `<p style="color:#64748b;font-size:13px">Approver Comment: ${leave.reviewer_comment}</p>` : '',
    },
    rejected: {
      subject: '❌ Your Leave Request has been Rejected',
      color: '#ef4444',
      title: 'Leave Rejected',
      body: `Your ${span} has been <span style="color:#ef4444;font-weight:700">rejected</span>.`,
      extra: leave.reviewer_comment ? `<p style="color:#64748b;font-size:13px">Approver Comment: ${leave.reviewer_comment}</p>` : '',
    },
    tl_approved: {
      subject: '✅ Your Leave was Approved by your Team Lead — Pending HR',
      color: '#10b981',
      title: 'Team Lead Approved',
      body: `Your ${span} has been <span style="color:#10b981;font-weight:700">approved by your Team Lead</span> and is now awaiting final HR approval.`,
      extra: leave.tl_comment ? `<p style="color:#64748b;font-size:13px">Team Lead Comment: ${leave.tl_comment}</p>` : '',
    },
    tl_rejected: {
      subject: '❌ Your Leave Request was Declined by Your Team Lead',
      color: '#f59e0b',
      title: 'Leave Declined by Team Lead',
      body: `Your ${span} has been <span style="color:#f59e0b;font-weight:700">declined</span> by your Team Lead.`,
      extra: leave.tl_comment ? `<p style="color:#64748b;font-size:13px">Team Lead Comment: ${leave.tl_comment}</p>` : '',
    },
  };
  const cfg = configs[action];
  if (!cfg) return Promise.resolve();
  return send(email, cfg.subject, `
    <div style="${baseStyle}"><div style="${cardStyle}">
      <h2 style="color:${cfg.color};margin-top:0">${cfg.title}</h2>
      <p style="color:#475569">Hello <strong>${employee.first_name}</strong>,</p>
      <p style="color:#475569">${cfg.body}</p>
      ${cfg.extra}
    </div></div>
  `);
};

// FYI to an associated reviewer (e.g. the TL) when a request they handled is
// finalised by HR / Superuser.
exports.sendReviewerOutcomeEmail = (toEmail, toName, employee, leave, action, deciderRole = 'HR') => {
  const approved = action === 'approved';
  const color = approved ? '#10b981' : '#ef4444';
  return send(toEmail,
    `${approved ? '✅' : '❌'} ${deciderRole} ${approved ? 'approved' : 'rejected'} ${employee.first_name}'s leave`,
    `<div style="${baseStyle}"><div style="${cardStyle}">
      <h2 style="color:${color};margin-top:0">Request ${approved ? 'Approved' : 'Rejected'} by ${deciderRole}</h2>
      <p style="color:#475569">Hello <strong>${toName}</strong>,</p>
      <p style="color:#475569">The ${typeLabel(leave)} (${durationLabel(leave)}) for <strong>${employee.first_name} ${employee.last_name}</strong>
        (${leave.start_date} → ${leave.end_date}) that you reviewed has been
        <span style="color:${color};font-weight:700">${approved ? 'approved' : 'rejected'}</span> by ${deciderRole}.</p>
      ${leave.reviewer_comment ? `<p style="color:#64748b;font-size:13px">${deciderRole} Comment: ${leave.reviewer_comment}</p>` : ''}
    </div></div>`
  );
};
