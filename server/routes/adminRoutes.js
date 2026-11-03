const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/employees', authMiddleware, adminController.getAdminDirectory);
router.post('/employees', authMiddleware, adminController.createEmployee);
router.put('/adjust-balance', authMiddleware, adminController.adjustBalance);
router.get('/export-audit', adminController.exportAuditLog);

module.exports = router;