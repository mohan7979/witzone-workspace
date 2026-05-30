const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const send = (to, subject, html) =>
  transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });

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
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px;width:110px">Leave Type</td><td style="font-weight:600;color:#1e293b;text-transform:capitalize">${leave.type.replace('_',' ')}</td></tr>
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px">From</td><td style="font-weight:600;color:#1e293b">${leave.start_date}</td></tr>
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px">To</td><td style="font-weight:600;color:#1e293b">${leave.end_date}</td></tr>
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px">Duration</td><td style="font-weight:600;color:#1e293b">${leave.duration_days} day(s)</td></tr>
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px;vertical-align:top">Reason</td><td style="color:#334155">${leave.reason}</td></tr>
        ${leave.document_note ? `<tr><td style="padding:7px 0;color:#94a3b8;font-size:13px;vertical-align:top">Document Note</td><td style="color:#334155">${leave.document_note}</td></tr>` : ''}
      </table>
      <p style="color:#64748b;font-size:13px">Please login to <strong>Witzone Workspace</strong> to approve or reject this request.</p>
    </div></div>`
  );

// Notify HR when TL approves — ready for final decision
exports.sendHrNotificationEmail = (hrEmail, employee, leave, tlName) =>
  send(hrEmail,
    `Leave Approved by TL — Awaiting HR Decision (${employee.first_name} ${employee.last_name})`,
    `<div style="${baseStyle}"><div style="${cardStyle}">
      <h2 style="color:#1e293b;margin-top:0">✅ TL Approved — Final Review Needed</h2>
      <p style="color:#475569">Team Lead <strong>${tlName}</strong> has approved the following leave. Your final decision is required.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px;width:110px">Employee</td><td style="font-weight:600;color:#1e293b">${employee.first_name} ${employee.last_name}</td></tr>
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px">Leave Type</td><td style="font-weight:600;color:#1e293b;text-transform:capitalize">${leave.type.replace('_',' ')}</td></tr>
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px">From</td><td style="font-weight:600;color:#1e293b">${leave.start_date}</td></tr>
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px">To</td><td style="font-weight:600;color:#1e293b">${leave.end_date}</td></tr>
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px">Duration</td><td style="font-weight:600;color:#1e293b">${leave.duration_days} day(s)</td></tr>
        <tr><td style="padding:7px 0;color:#94a3b8;font-size:13px;vertical-align:top">Reason</td><td style="color:#334155">${leave.reason}</td></tr>
        ${leave.tl_comment ? `<tr><td style="padding:7px 0;color:#94a3b8;font-size:13px;vertical-align:top">TL Comment</td><td style="color:#334155">${leave.tl_comment}</td></tr>` : ''}
      </table>
      <p style="color:#64748b;font-size:13px">Please login to <strong>Witzone Workspace</strong> to give the final approval or rejection.</p>
    </div></div>`
  );

// Notify employee of any status update
exports.sendLeaveNotificationEmail = (email, employee, leave, action) => {
  const configs = {
    approved: {
      subject: '✅ Your Leave Request has been Approved',
      color: '#10b981',
      title: 'Leave Approved',
      body: `Your <strong>${leave.type.replace('_',' ')}</strong> leave from <strong>${leave.start_date}</strong> to <strong>${leave.end_date}</strong> has been <span style="color:#10b981;font-weight:700">approved</span>.`,
      extra: leave.reviewer_comment ? `<p style="color:#64748b;font-size:13px">HR Comment: ${leave.reviewer_comment}</p>` : '',
    },
    rejected: {
      subject: '❌ Your Leave Request has been Rejected',
      color: '#ef4444',
      title: 'Leave Rejected',
      body: `Your <strong>${leave.type.replace('_',' ')}</strong> leave from <strong>${leave.start_date}</strong> to <strong>${leave.end_date}</strong> has been <span style="color:#ef4444;font-weight:700">rejected</span>.`,
      extra: leave.reviewer_comment ? `<p style="color:#64748b;font-size:13px">HR Comment: ${leave.reviewer_comment}</p>` : '',
    },
    tl_rejected: {
      subject: '❌ Your Leave Request was Declined by Your Team Lead',
      color: '#f59e0b',
      title: 'Leave Declined by Team Lead',
      body: `Your <strong>${leave.type.replace('_',' ')}</strong> leave from <strong>${leave.start_date}</strong> to <strong>${leave.end_date}</strong> has been <span style="color:#f59e0b;font-weight:700">declined</span> by your Team Lead.`,
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
