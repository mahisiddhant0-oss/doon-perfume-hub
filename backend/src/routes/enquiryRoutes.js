const express = require('express');
const router = express.Router();
const { getEnquiries } = require('../controllers/enquiryController');
const { protect, adminRights } = require('../middlewares/authMiddleware');

router.get('/', protect, adminRights, getEnquiries);

module.exports = router;
