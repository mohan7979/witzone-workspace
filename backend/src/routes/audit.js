const router = require('express').Router();
const { listAudit } = require('../controllers/auditController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Audit trail is visible to HR and Superusers only.
router.get('/', authorize('hr', 'superuser'), listAudit);

module.exports = router;
