const router = require('express').Router();
const { heartbeat, myIdleSummary, teamIdleSummary, liveIdleStatus, idleDetail } = require('../controllers/idleController');
const { requestScreen, pollScreen, uploadScreen, getScreen } = require('../controllers/screenController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.post('/heartbeat', heartbeat);
router.get('/my', myIdleSummary);
router.get('/detail', idleDetail);
router.get('/team', authorize('hr', 'lead'), teamIdleSummary);
router.get('/live', authorize('hr', 'lead'), liveIdleStatus);

// Live screen viewing (superuser-only). The agent endpoints (poll/frame) use the
// employee's own token; declared before '/screen/:userId' so they aren't shadowed.
router.get('/screen/poll',   pollScreen);                                       // agent → "should I capture?"
router.post('/screen/frame', uploadScreen);                                     // agent → upload a frame
router.post('/screen/request/:userId', authorize('superuser'), requestScreen);  // superuser → start / keep-alive
router.get('/screen/:userId',          authorize('superuser'), getScreen);      // superuser → latest frame

module.exports = router;
