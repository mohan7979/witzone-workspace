const router = require('express').Router();
const mc = require('../controllers/masterController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Read: HR + Lead + Employee can read (needed for dropdowns)
router.get('/departments',  mc.listDepartments);
router.get('/designations', mc.listDesignations);
router.get('/holidays',     mc.listHolidays);
router.get('/shifts',       mc.listShifts);

// Write: HR only
router.use(authorize('hr'));
router.post  ('/departments',      mc.createDepartment);
router.patch ('/departments/:id',  mc.updateDepartment);
router.delete('/departments/:id',  mc.deleteDepartment);

router.post  ('/designations',     mc.createDesignation);
router.patch ('/designations/:id', mc.updateDesignation);
router.delete('/designations/:id', mc.deleteDesignation);

router.post  ('/holidays',         mc.createHoliday);
router.patch ('/holidays/:id',     mc.updateHoliday);
router.delete('/holidays/:id',     mc.deleteHoliday);

router.post  ('/shifts',           mc.createShift);
router.patch ('/shifts/:id',       mc.updateShift);
router.delete('/shifts/:id',       mc.deleteShift);

module.exports = router;
