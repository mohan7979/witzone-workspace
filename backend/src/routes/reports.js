const router = require('express').Router();
const { attendanceSummary, leaveReport, idleReport, idleHistory, dashboardStats } = require('../controllers/reportController');
const { activityReport } = require('../controllers/activityReportController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('hr', 'lead'));

router.get('/dashboard', dashboardStats);
router.get('/attendance', attendanceSummary);
router.get('/leaves', leaveReport);
router.get('/idle', idleReport);
router.get('/idle-history', idleHistory);   // period (daily/weekly/monthly/yearly) × scope (global/dept/employee)
router.get('/activity', activityReport);   // full per-record HR activity report + exports

module.exports = router;
