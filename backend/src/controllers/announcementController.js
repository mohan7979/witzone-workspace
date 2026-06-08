const { Op } = require('sequelize');
const { Announcement, User } = require('../models');
const asyncHandler = require('../utils/asyncHandler');

exports.list = asyncHandler(async (req, res) => {
  const rows = await Announcement.findAll({
    include: [{ model: User, as: 'author', attributes: ['first_name', 'last_name', 'role'] }],
    order: [['is_pinned', 'DESC'], ['created_at', 'DESC']],
    limit: 50,
  });
  res.json({ data: rows });
});

// Count of announcements newer than the user last viewed (for the sidebar badge).
exports.unreadCount = asyncHandler(async (req, res) => {
  const since = req.user.announcements_seen_at;
  const where = since ? { created_at: { [Op.gt]: since } } : {};
  const count = await Announcement.count({ where });
  res.json({ count });
});

// Mark all announcements as seen (called when the user opens the page).
exports.markSeen = asyncHandler(async (req, res) => {
  await User.update({ announcements_seen_at: new Date() }, { where: { id: req.user.id } });
  res.json({ ok: true });
});

exports.create = asyncHandler(async (req, res) => {
  const { title, body, is_pinned } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });
  const ann = await Announcement.create({
    title: title.trim(),
    body: body?.trim(),
    is_pinned: !!is_pinned,
    created_by: req.user.id,
  });
  const full = await Announcement.findByPk(ann.id, {
    include: [{ model: User, as: 'author', attributes: ['first_name', 'last_name', 'role'] }],
  });
  res.status(201).json({ data: full });
});

exports.update = asyncHandler(async (req, res) => {
  const ann = await Announcement.findByPk(req.params.id);
  if (!ann) return res.status(404).json({ message: 'Announcement not found' });
  await ann.update(req.body);
  res.json({ data: ann });
});

exports.remove = asyncHandler(async (req, res) => {
  const ann = await Announcement.findByPk(req.params.id);
  if (!ann) return res.status(404).json({ message: 'Announcement not found' });
  await ann.destroy();
  res.json({ message: 'Deleted' });
});
