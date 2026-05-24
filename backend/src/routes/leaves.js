const router = require('express').Router();
const { apply, myLeaves, cancel, pendingLeaves, review } = require('../controllers/leaveController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.post('/', apply);
router.get('/my', myLeaves);
router.patch('/:id/cancel', cancel);
router.get('/pending', authorize('hr', 'lead'), pendingLeaves);
router.patch('/:id/review', authorize('hr', 'lead'), review);

module.exports = router;
