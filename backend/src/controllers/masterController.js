const { Op } = require('sequelize');
const { Department, Designation, Holiday, ShiftTemplate } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

/* ─── DEPARTMENTS ──────────────────────────────────────────────────── */

exports.listDepartments = asyncHandler(async (req, res) => {
  const rows = await Department.findAll({ order: [['name', 'ASC']] });
  res.json({ data: rows });
});

exports.createDepartment = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });
  const dept = await Department.create({ name: name.trim() });
  res.status(201).json({ data: dept });
});

exports.updateDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findByPk(req.params.id);
  if (!dept) return res.status(404).json({ message: 'Department not found' });
  await dept.update(req.body);
  res.json({ data: dept });
});

exports.deleteDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findByPk(req.params.id);
  if (!dept) return res.status(404).json({ message: 'Department not found' });
  await dept.destroy();
  res.json({ message: 'Deleted' });
});

/* ─── DESIGNATIONS ─────────────────────────────────────────────────── */

exports.listDesignations = asyncHandler(async (req, res) => {
  const rows = await Designation.findAll({ order: [['name', 'ASC']] });
  res.json({ data: rows });
});

exports.createDesignation = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });
  const desig = await Designation.create({ name: name.trim() });
  res.status(201).json({ data: desig });
});

exports.updateDesignation = asyncHandler(async (req, res) => {
  const desig = await Designation.findByPk(req.params.id);
  if (!desig) return res.status(404).json({ message: 'Designation not found' });
  await desig.update(req.body);
  res.json({ data: desig });
});

exports.deleteDesignation = asyncHandler(async (req, res) => {
  const desig = await Designation.findByPk(req.params.id);
  if (!desig) return res.status(404).json({ message: 'Designation not found' });
  await desig.destroy();
  res.json({ message: 'Deleted' });
});

/* ─── HOLIDAYS ─────────────────────────────────────────────────────── */

exports.listHolidays = asyncHandler(async (req, res) => {
  const { year } = req.query;
  const where = {};
  if (year) {
    where.date = {
      [Op.between]: [`${year}-01-01`, `${year}-12-31`],
    };
  }
  const rows = await Holiday.findAll({ where, order: [['date', 'ASC']] });
  res.json({ data: rows });
});

exports.createHoliday = asyncHandler(async (req, res) => {
  const { name, date, type } = req.body;
  if (!name || !date) return res.status(400).json({ message: 'Name and date are required' });
  const holiday = await Holiday.create({ name: name.trim(), date, type: type || 'company' });
  res.status(201).json({ data: holiday });
});

exports.updateHoliday = asyncHandler(async (req, res) => {
  const holiday = await Holiday.findByPk(req.params.id);
  if (!holiday) return res.status(404).json({ message: 'Holiday not found' });
  await holiday.update(req.body);
  res.json({ data: holiday });
});

exports.deleteHoliday = asyncHandler(async (req, res) => {
  const holiday = await Holiday.findByPk(req.params.id);
  if (!holiday) return res.status(404).json({ message: 'Holiday not found' });
  await holiday.destroy();
  res.json({ message: 'Deleted' });
});

/* ─── SHIFT TEMPLATES ──────────────────────────────────────────────── */

exports.listShifts = asyncHandler(async (req, res) => {
  const rows = await ShiftTemplate.findAll({ order: [['name', 'ASC']] });
  res.json({ data: rows });
});

/* Auto-detect if a shift crosses midnight (e.g. 22:00 → 06:00) */
function detectCrossesMidnight(start_time, end_time) {
  return start_time > end_time; // "22:00" > "06:00" is true
}

exports.createShift = asyncHandler(async (req, res) => {
  const { name, shift_type = 'day', start_time, end_time } = req.body;
  if (!name || !start_time || !end_time)
    return res.status(400).json({ message: 'Name, start_time and end_time are required' });

  const crosses_midnight = detectCrossesMidnight(start_time, end_time);
  const shift = await ShiftTemplate.create({
    name: name.trim(), shift_type, start_time, end_time, crosses_midnight,
  });
  res.status(201).json({ data: shift });
});

exports.updateShift = asyncHandler(async (req, res) => {
  const shift = await ShiftTemplate.findByPk(req.params.id);
  if (!shift) return res.status(404).json({ message: 'Shift not found' });

  // Recalculate crosses_midnight if times changed
  const start = req.body.start_time || shift.start_time;
  const end   = req.body.end_time   || shift.end_time;
  req.body.crosses_midnight = detectCrossesMidnight(start, end);

  await shift.update(req.body);
  res.json({ data: shift });
});

exports.deleteShift = asyncHandler(async (req, res) => {
  const shift = await ShiftTemplate.findByPk(req.params.id);
  if (!shift) return res.status(404).json({ message: 'Shift not found' });
  await shift.destroy();
  res.json({ message: 'Deleted' });
});
