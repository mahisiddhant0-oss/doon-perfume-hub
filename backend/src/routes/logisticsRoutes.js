const express = require('express');
const router = express.Router();
const { trackOrder, syncDeliveredOrders } = require('../controllers/logisticsController');
const { protect, adminRights } = require('../middlewares/authMiddleware');

// @route   GET /api/logistics/track/:orderId
// @access  Public (or Protected)
router.get('/track/:orderId', trackOrder);
router.post('/sync-delivered', protect, adminRights, syncDeliveredOrders);

module.exports = router;
