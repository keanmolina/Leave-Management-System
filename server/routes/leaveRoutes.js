const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const leaveController = require('../controllers/leaveController');
const authMiddleware = require('../middleware/authMiddleware');

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Routes
router.get('/calendar', authMiddleware, leaveController.getCalendarEvents);
router.get('/check-overlap', authMiddleware, leaveController.checkOverlap);
router.get('/my-leaves', authMiddleware, leaveController.getMyLeaves);
router.post('/apply', authMiddleware, upload.single('attachment'), leaveController.applyLeave);
router.put('/cancel/:id', authMiddleware, leaveController.cancelLeave);

// Supervisor Queue & Review
router.get('/supervisor/queue', authMiddleware, leaveController.getSupervisorQueue);
router.put('/supervisor/review/:id', authMiddleware, leaveController.reviewSupervisor);

// HR Admin Queue & Review
router.get('/admin/queue', authMiddleware, leaveController.getAdminQueue);
router.put('/admin/review/:id', authMiddleware, leaveController.reviewAdmin);

module.exports = router;