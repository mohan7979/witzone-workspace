const router = require('express').Router();
const { createUser, listUsers, getUser, updateUser, departments, terminateUser, reactivateUser, leaveBalances } = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('hr', 'lead'));

router.post('/', authorize('hr'), createUser);
router.get('/', listUsers);
router.get('/departments', departments);
router.get('/leave-balances', leaveBalances);
router.get('/:id', getUser);
router.patch('/:id', authorize('hr'), updateUser);
router.delete('/:id', authorize('hr'), terminateUser);
router.patch('/:id/reactivate', authorize('hr'), reactivateUser);

module.exports = router;
