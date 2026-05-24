const router = require('express').Router();
const ac = require('../controllers/announcementController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', ac.list);

// HR/Lead can create, update, delete
router.post  ('/',     authorize('hr', 'lead'), ac.create);
router.patch ('/:id',  authorize('hr', 'lead'), ac.update);
router.delete('/:id',  authorize('hr', 'lead'), ac.remove);

module.exports = router;
