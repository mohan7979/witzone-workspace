const router = require('express').Router();
const { exitAttempt } = require('../controllers/agentController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// Agent → request to quit (admin-password gated; alerts HR/Superadmin every time).
router.post('/exit-attempt', exitAttempt);

module.exports = router;
