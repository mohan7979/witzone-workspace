const router = require('express').Router();
const { clockIn, clockOut, startBreak, endBreak, todayStatus, myHistory, teamAttendance, calendarView } = require('../controllers/attendanceController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.post('/clock-in',    clockIn);
router.post('/clock-out',   clockOut);
router.post('/start-break', startBreak);
router.post('/end-break',   endBreak);
router.get('/today',        todayStatus);
router.get('/my-history',   myHistory);
router.get('/team',         authorize('hr', 'lead'), teamAttendance);
router.get('/calendar',     calendarView);

module.exports = router;
