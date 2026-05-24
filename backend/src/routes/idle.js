const router = require('express').Router();
const { heartbeat, myIdleSummary, teamIdleSummary, liveIdleStatus, idleDetail } = require('../controllers/idleController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.post('/heartbeat', heartbeat);
router.get('/my', myIdleSummary);
router.get('/detail', idleDetail);
router.get('/team', authorize('hr', 'lead'), teamIdleSummary);
router.get('/live', authorize('hr', 'lead'), liveIdleStatus);

module.exports = router;
