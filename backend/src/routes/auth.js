const router = require('express').Router();
const { login, changePassword, adminResetPassword, me, updateProfile } = require('../controllers/authController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/login', login);
router.get('/me', authenticate, me);
router.patch('/change-password', authenticate, changePassword);
router.post('/reset-password/:user_id', authenticate, authorize('hr', 'lead'), adminResetPassword);
router.patch('/profile', authenticate, updateProfile);

module.exports = router;
