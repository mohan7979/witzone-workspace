const { Op } = require('sequelize');
const moment = require('moment-timezone');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Attendance, User, BreakLog } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { todayIST, TZ } = require('../utils/ist');

/* ── formatting helpers ─────────────────────────────────────────────────── */
const fmtClock = (d) => (d ? moment.tz(d, TZ).format('hh:mm:ss A') : '—');
const fmtHMS = (secs) => {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
};

/* ── core data builder (shared by JSON + every export format) ───────────── */
async function buildActivityRows({ start, end, userId, department, requesterRole, requesterId }) {
  const userWhere = { status: 'active' };
  if (department) userWhere.department = department;
  if (userId)     userWhere.id = userId;
  // Leads are scoped to their own team; HR / Superuser see everyone.
  if (requesterRole === 'lead') userWhere.manager_id = requesterId;

  const attendances = await Attendance.findAll({
    where: { date: { [Op.between]: [start, end] } },
    include: [{
      model: User, as: 'user', where: userWhere,
      attributes: ['id', 'employee_id', 'first_name', 'last_name', 'department'],
    }],
    order: [['date', 'DESC'], ['login_time', 'ASC']],
  });

  const userIds = [...new Set(attendances.map((a) => a.user_id))];
  const breaks = userIds.length
    ? await BreakLog.findAll({
        where: { user_id: { [Op.in]: userIds }, date: { [Op.between]: [start, end] } },
        order: [['break_start', 'ASC']],
      })
    : [];

  const breakMap = {};
  for (const b of breaks) {
    const k = `${b.user_id}|${b.date}`;
    (breakMap[k] = breakMap[k] || []).push(b);
  }

  return attendances.map((a) => {
    const recBreaks = (breakMap[`${a.user_id}|${a.date}`] || []).map((b) => ({
      in: b.break_start, out: b.break_end, duration_seconds: b.duration_seconds || 0,
    }));
    return {
      employee_id: a.user?.employee_id || '',
      name:        `${a.user?.first_name || ''} ${a.user?.last_name || ''}`.trim(),
      department:  a.user?.department || '',
      date:        a.date,
      clock_in:    a.login_time,
      clock_out:   a.logout_time,
      clock_in_2:  a.login_time_2,
      clock_out_2: a.logout_time_2,
      breaks:      recBreaks,
      total_break_seconds: a.total_break_seconds || 0,
      idle_seconds:        a.idle_seconds || 0,
      total_hours:         a.total_hours,
      effective_hours:     a.effective_hours,
      status:      a.status,
    };
  });
}

// Flatten break pairs into one human-readable cell, e.g. "10:30 AM→10:45 AM (00:15:00)".
function breaksCell(breaks) {
  if (!breaks.length) return '—';
  return breaks
    .map((b) => `${fmtClock(b.in)}→${b.out ? fmtClock(b.out) : 'ongoing'} (${fmtHMS(b.duration_seconds)})`)
    .join('; ');
}

const COLUMNS = [
  { key: 'date',        header: 'Date',              w: 12 },
  { key: 'employee_id', header: 'Emp ID',            w: 12 },
  { key: 'name',        header: 'Employee',          w: 22 },
  { key: 'department',  header: 'Department',        w: 16 },
  { key: 'clock_in',    header: 'Clock In',          w: 14, time: true },
  { key: 'clock_out',   header: 'Clock Out',         w: 14, time: true },
  { key: 'clock_in_2',  header: '2nd Clock In',      w: 14, time: true },
  { key: 'clock_out_2', header: '2nd Clock Out',     w: 14, time: true },
  { key: 'breaks',      header: 'Break In / Out',    w: 34, breaks: true },
  { key: 'total_break_seconds', header: 'Total Break', w: 13, hms: true },
  { key: 'idle_seconds',        header: 'Idle Time',   w: 13, hms: true },
  { key: 'status',      header: 'Status',            w: 11 },
];

function cellValue(row, col) {
  if (col.time)   return fmtClock(row[col.key]);
  if (col.hms)    return fmtHMS(row[col.key]);
  if (col.breaks) return breaksCell(row.breaks);
  if (col.key === 'date') return moment.tz(row.date, TZ).format('DD-MMM-YYYY');
  return row[col.key] != null ? String(row[col.key]) : '—';
}

/* ── exporters ──────────────────────────────────────────────────────────── */
function sendCsv(res, rows, start, end) {
  const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [COLUMNS.map((c) => esc(c.header)).join(',')];
  for (const r of rows) lines.push(COLUMNS.map((c) => esc(cellValue(r, c))).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="activity_${start}_to_${end}.csv"`);
  res.send('﻿' + lines.join('\r\n')); // BOM so Excel reads UTF-8
}

async function sendXlsx(res, rows, start, end) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Witzone HRMS';
  const ws = wb.addWorksheet('Activity');

  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.w }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };

  for (const r of rows) {
    ws.addRow(Object.fromEntries(COLUMNS.map((c) => [c.key, cellValue(r, c)])));
  }
  ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + COLUMNS.length)}1` };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="activity_${start}_to_${end}.xlsx"`);
  const buf = await wb.xlsx.writeBuffer();
  res.send(Buffer.from(buf));
}

function sendPdf(res, rows, start, end) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 28 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="activity_${start}_to_${end}.pdf"`);
  doc.pipe(res);

  doc.fontSize(15).fillColor('#111111').text('HR Activity Report', { align: 'left' });
  doc.fontSize(9).fillColor('#555555')
    .text(`Range: ${moment.tz(start, TZ).format('DD-MMM-YYYY')} — ${moment.tz(end, TZ).format('DD-MMM-YYYY')}    Records: ${rows.length}`);
  doc.moveDown(0.6);

  // Compact column set for PDF readability.
  const pcols = [
    { key: 'date', header: 'Date', w: 62, time: false, fmt: (r) => moment.tz(r.date, TZ).format('DD-MMM') },
    { key: 'name', header: 'Employee', w: 96 },
    { key: 'clock_in', header: 'In', w: 56, time: true },
    { key: 'clock_out', header: 'Out', w: 56, time: true },
    { key: 'clock_in_2', header: '2nd In', w: 56, time: true },
    { key: 'clock_out_2', header: '2nd Out', w: 56, time: true },
    { key: 'idle_seconds', header: 'Idle', w: 58, hms: true },
    { key: 'total_break_seconds', header: 'Break', w: 58, hms: true },
    { key: 'status', header: 'Status', w: 56 },
  ];
  const startX = doc.x;
  let y = doc.y;
  const rowH = 16;

  const drawRow = (cells, opts = {}) => {
    let x = startX;
    if (opts.header) { doc.rect(x, y, pcols.reduce((s, c) => s + c.w, 0), rowH).fill('#6366F1'); }
    doc.fontSize(8).fillColor(opts.header ? '#FFFFFF' : '#111111');
    pcols.forEach((c, i) => {
      doc.text(String(cells[i]), x + 3, y + 4, { width: c.w - 6, ellipsis: true, lineBreak: false });
      x += c.w;
    });
    y += rowH;
  };

  drawRow(pcols.map((c) => c.header), { header: true });
  for (const r of rows) {
    if (y > doc.page.height - 40) { doc.addPage(); y = doc.y; drawRow(pcols.map((c) => c.header), { header: true }); }
    const cells = pcols.map((c) =>
      c.fmt ? c.fmt(r) : c.time ? fmtClock(r[c.key]) : c.hms ? fmtHMS(r[c.key]) : (r[c.key] != null ? String(r[c.key]) : '—')
    );
    drawRow(cells);
  }

  if (rows.length === 0) { doc.fontSize(10).fillColor('#888888').text('No activity records for this range.', startX, y + 8); }
  doc.end();
}

/* ── route handler ──────────────────────────────────────────────────────── */
exports.activityReport = asyncHandler(async (req, res) => {
  const { start, end, user_id, department, format = 'json' } = req.query;
  const s = start || todayIST();
  const e = end   || todayIST();

  const rows = await buildActivityRows({
    start: s, end: e, userId: user_id, department,
    requesterRole: req.user.role, requesterId: req.user.id,
  });

  if (format === 'csv')  return sendCsv(res, rows, s, e);
  if (format === 'xlsx') return sendXlsx(res, rows, s, e);
  if (format === 'pdf')  return sendPdf(res, rows, s, e);

  res.json({ start: s, end: e, count: rows.length, data: rows });
});
