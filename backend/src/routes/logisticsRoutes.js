const express = require('express');
const router = express.Router();
const { trackOrder } = require('../controllers/logisticsController');

// @route   GET /api/logistics/track/:orderId
// @access  Public (or Protected)
router.get('/track/:orderId', trackOrder);

module.exports = router;
