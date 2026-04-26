const Order = require('../models/Order');
const delhiveryService = require('../services/delhiveryService');

const extractTrackingStatus = (trackingData = {}) => {
  const shipment = trackingData?.ShipmentData?.[0]?.Shipment || {};
  const scans = shipment?.Scans || [];
  const latestScan = scans[0]?.ScanDetail || {};

  const statusValue =
    latestScan?.Status ||
    latestScan?.Instructions ||
    shipment?.Status?.Status ||
    shipment?.Status?.StatusType ||
    trackingData?.status ||
    '';

  return String(statusValue || '').toLowerCase();
};

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

/**
 * @desc    Sync logistics status and auto-fulfill delivered paid orders
 * @route   POST /api/logistics/sync-delivered
 * @access  Private/Admin
 */
const syncDeliveredOrders = async (req, res) => {
  try {
    const candidateOrders = await Order.find({
      paymentStatus: 'paid',
      orderStatus: { $in: ['processing', 'shipped'] },
      awbNumber: { $exists: true, $ne: '' },
    });

    let deliveredCount = 0;
    let updatedCount = 0;

    for (const order of candidateOrders) {
      try {
        const trackingData = await delhiveryService.trackShipment(order.awbNumber);
        const status = extractTrackingStatus(trackingData);

        if (!status) {
          continue;
        }

        if (status.includes('deliver')) {
          order.orderStatus = 'delivered';
          order.logisticsStatus = 'delivered';
          order.isFulfilled = true;
          order.deliveredAt = new Date();
          order.fulfilledAt = new Date();
          deliveredCount += 1;
          updatedCount += 1;
          await order.save();
          continue;
        }

        if (order.logisticsStatus !== status) {
          order.logisticsStatus = status;
          updatedCount += 1;
          await order.save();
        }
      } catch (trackError) {
        console.error(`syncDeliveredOrders tracking error for ${order._id}:`, trackError.message);
      }
    }

    return res.json({
      message: 'Logistics sync completed',
      scanned: candidateOrders.length,
      updated: updatedCount,
      delivered: deliveredCount,
    });
  } catch (error) {
    console.error('syncDeliveredOrders error:', error.message);
    return res.status(500).json({ message: 'Failed to sync logistics status', error: error.message });
  }
};

module.exports = {
  trackOrder,
  syncDeliveredOrders,
};
