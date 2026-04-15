const Order = require('../models/Order');
const delhiveryService = require('../services/delhiveryService');

/**
 * @desc    Track a shipment via Delhivery
 * @route   GET /api/logistics/track/:orderId
 * @access  Public (or Protected)
 */
const trackOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!order.awbNumber) {
      return res.status(400).json({ 
        message: 'Order has no AWB assigned yet. Tracking is only available after shipment is processed.',
        status: order.orderStatus 
      });
    }

    // Call Delhivery Service to get tracking details
    const trackingData = await delhiveryService.trackShipment(order.awbNumber);

    if (!trackingData || !trackingData.ShipmentData) {
        return res.status(200).json({
            orderId: order._id,
            awbNumber: order.awbNumber,
            status: order.orderStatus,
            tracking: {
                status: "Processed",
                details: "Shipment is being prepared for pickup."
            }
        });
    }

    // Return the tracking data from Delhivery
    res.json({
      orderId: order._id,
      awbNumber: order.awbNumber,
      status: order.orderStatus,
      tracking: trackingData.ShipmentData[0] // Typically an array
    });

  } catch (error) {
    console.error('Tracking Error:', error);
    res.status(500).json({ message: 'Failed to fetch tracking information', error: error.message });
  }
};

module.exports = {
  trackOrder
};
