const router = require('express').Router();
const { apply, myLeaves, cancel, pendingLeaves, tlReview, hrReview, getPolicy, resetAnnualLeaves, viewDocument } = require('../controllers/leaveController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const path   = require('path');

router.use(authenticate);

router.get('/policy',           getPolicy);                          // all roles
// medical_cert is the optional file field (multer); single() so only one file is accepted
router.post('/',                upload.single('medical_cert'), apply);
router.get('/my',               myLeaves);
router.get('/:id/document',     viewDocument);     // requester / TL / HR / Superuser
router.patch('/:id/cancel',     cancel);
router.get('/pending',          authorize('hr', 'lead'), pendingLeaves);
router.patch('/:id/tl-review',  authorize('hr', 'lead'), tlReview);   // lead = employee's TL; hr = slot A on a TL's request (controller enforces)
router.patch('/:id/hr-review',  authorize('hr'),         hrReview);
router.post('/reset-annual',    authorize('hr'),         resetAnnualLeaves);

module.exports = router;
