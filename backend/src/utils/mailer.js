const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const send = (to, subject, html) =>
  transporter.sendMail({ from: process.env.EMAIL_FROM, to, subject, html });

exports.sendWelcomeEmail = (email, name, employeeId, tempPassword) =>
  send(email, 'Welcome to Witzone Workspace — Your Credentials', `
    <h2>Welcome, ${name}!</h2>
    <p>Your account has been created.</p>
    <p><b>Employee ID:</b> ${employeeId}</p>
    <p><b>Email:</b> ${email}</p>
    <p><b>Temporary Password:</b> <code>${tempPassword}</code></p>
    <p>Please log in and change your password immediately.</p>
  `);

exports.sendPasswordResetEmail = (email, name, tempPassword) =>
  send(email, 'Witzone Workspace — Password Reset', `
    <h2>Hello, ${name}</h2>
    <p>Your password has been reset by an administrator.</p>
    <p><b>New Temporary Password:</b> <code>${tempPassword}</code></p>
    <p>Please log in and change your password immediately.</p>
  `);

exports.sendLeaveNotificationEmail = (email, employee, leave, action) => {
  const subjects = {
    new: `Leave Request from ${employee.first_name} ${employee.last_name}`,
    approved: 'Your Leave Request has been Approved',
    rejected: 'Your Leave Request has been Rejected',
  };
  const messages = {
    new: `<p>${employee.first_name} has applied for <b>${leave.type}</b> leave from <b>${leave.start_date}</b> to <b>${leave.end_date}</b>.<br>Reason: ${leave.reason}</p>`,
    approved: `<p>Your <b>${leave.type}</b> leave from <b>${leave.start_date}</b> to <b>${leave.end_date}</b> has been <b style="color:green">approved</b>.<br>${leave.reviewer_comment ? `Comment: ${leave.reviewer_comment}` : ''}</p>`,
    rejected: `<p>Your <b>${leave.type}</b> leave from <b>${leave.start_date}</b> to <b>${leave.end_date}</b> has been <b style="color:red">rejected</b>.<br>${leave.reviewer_comment ? `Reason: ${leave.reviewer_comment}` : ''}</p>`,
  };
  return send(email, subjects[action], `<h3>Witzone Workspace — Leave Update</h3>${messages[action]}`);
};
