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
  const { department } = req.query;
  const where = {};
  if (department) where.department = department;
  const rows = await Designation.findAll({ where, order: [['name', 'ASC']] });
  res.json({ data: rows });
});

exports.createDesignation = asyncHandler(async (req, res) => {
  const { name, department } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });
  const desig = await Designation.create({ name: name.trim(), department: department?.trim() });
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
  const holiday = await Holiday.create({ name: name.trim(), date, type: type || 'national' });
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

exports.createShift = asyncHandler(async (req, res) => {
  const { name, start_time, end_time } = req.body;
  if (!name || !start_time || !end_time)
    return res.status(400).json({ message: 'Name, start_time and end_time are required' });
  const shift = await ShiftTemplate.create({ name: name.trim(), start_time, end_time });
  res.status(201).json({ data: shift });
});

exports.updateShift = asyncHandler(async (req, res) => {
  const shift = await ShiftTemplate.findByPk(req.params.id);
  if (!shift) return res.status(404).json({ message: 'Shift not found' });
  await shift.update(req.body);
  res.json({ data: shift });
});

exports.deleteShift = asyncHandler(async (req, res) => {
  const shift = await ShiftTemplate.findByPk(req.params.id);
  if (!shift) return res.status(404).json({ message: 'Shift not found' });
  await shift.destroy();
  res.json({ message: 'Deleted' });
});
