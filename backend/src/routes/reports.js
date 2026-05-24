const router = require('express').Router();
const { attendanceSummary, leaveReport, idleReport, dashboardStats } = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('hr', 'lead'));

router.get('/dashboard', dashboardStats);
router.get('/attendance', attendanceSummary);
router.get('/leaves', leaveReport);
router.get('/idle', idleReport);

module.exports = router;
