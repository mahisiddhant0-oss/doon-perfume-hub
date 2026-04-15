// Delhivery API documentation: https://www.delhivery.com/support/

const axios = require('axios');

// For staging/testing, we use the test URL. Change to production in production environment.
const BASE_URL = process.env.DELHIVERY_ENVIRONMENT === 'production' 
  ? 'https://track.delhivery.com' 
  : 'https://staging-express.delhivery.com';

const HEADERS = {
  'Authorization': `Token ${process.env.DELHIVERY_TOKEN || 'TEST_TOKEN'}`,
  'Content-Type': 'application/json'
};

/**
 * Creates a shipment and generates an AWB
 * @param {Object} order - Full mongoose Order object
 * @returns {Object} - Contains AWB details
 */
const createShipment = async (order) => {
  try {
    // We map our system's Order data into Delhivery's extremely specific 'format: json' payload string requirement
    const payload = {
      format: "json",
      data: {
        shipments: [
          {
            name: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
            add: order.shippingAddress.street + (order.shippingAddress.apartment ? `, ${order.shippingAddress.apartment}` : ''),
            pin: order.shippingAddress.pincode,
            city: order.shippingAddress.city,
            state: order.shippingAddress.state,
            country: "India",
            phone: order.shippingAddress.phone,
            order: order._id.toString(),
            payment_mode: "Pre-paid", // Safely assumed since Razorpay handled it
            return_pin: "248001", // Example Doon Perfume Hub Dehradun Return Pin
            return_city: "Dehradun",
            return_phone: "9876543210",
            return_add: "Doon Perfume Hub Storage, Dehradun",
            return_state: "Uttarakhand",
            return_country: "India",
            products_desc: order.items.map(i => i.name).join(", "),
            cod_amount: "0",
            total_amount: order.totalAmount.toString(),
            seller_inv: `INV-${order._id.toString()}`,
            quantity: order.items.reduce((acc, curr) => acc + curr.quantity, 0).toString(),
            waybill: "" 
          }
        ],
        pickup_location: {
          name: "DOON PERFUME HUB MAIN",
          add: "Doon Perfume Hub HQ",
          city: "Dehradun",
          pin_code: "248001",
          country: "India",
          phone: "9876543210"
        }
      }
    };

    // Note: If no token is provided in the .env, we assume this is a DEV run and mock the response
    if (!process.env.DELHIVERY_TOKEN) {
      console.log('📦 [DEV] Mocking Delhivery AWB Generation for Order:', order._id);
      return { status: 200, awbNumber: `MOCK_AWB_${Date.now()}` };
    }

    const response = await axios.post(
      `${BASE_URL}/api/cmu/create.json`, 
      `format=json&data=${JSON.stringify(payload.data)}`, 
      { headers: HEADERS }
    );

    if (response.data.success) {
       return { 
         status: 200, 
         awbNumber: response.data.packages[0].waybill 
       };
    } else {
       throw new Error(response.data.error || 'Failed to generate AWB');
    }

  } catch (error) {
    console.error("Delhivery API Error:", error.message);
    // Depending on business requirements, you might want to return an object rather than throwing 
    // to prevent the entire verify loop from crashing, but throwing ensures visibility.
    throw new Error('Logistics Integration Failed: ' + error.message);
  }
};

/**
 * Schedules a pickup request with Delhivery
 * @param {Object} order - Full mongoose Order object
 * @returns {Object} - Pickup request status
 */
const schedulePickup = async (order) => {
  try {
    const now = new Date();
    const cutoff = 14; // 2 PM
    let pickupDate = new Date();

    // If past cutoff, schedule for next day
    if (now.getHours() >= cutoff) {
      pickupDate.setDate(now.getDate() + 1);
    }

    // Format YYYY-MM-DD
    const dateStr = pickupDate.toISOString().split('T')[0];

    const payload = {
      pickup_time: "14:00", // User's preferred time
      pickup_date: dateStr,
      pickup_location: process.env.DELHIVERY_PICKUP_LOCATION || "DOON PERFUME HUB MAIN",
      expected_package_count: order.items.reduce((acc, curr) => acc + curr.quantity, 0)
    };

    if (!process.env.DELHIVERY_TOKEN || order.awbNumber.startsWith('MOCK_AWB_')) {
      console.log('📦 [DEV] Mocking Delhivery Pickup Request for Order:', order._id, 'on', dateStr);
      return { status: 200, message: "Pickup scheduled (MOCK)" };
    }

    const response = await axios.post(
      `${BASE_URL}/fm/request/new/`, 
      payload, 
      { headers: HEADERS }
    );

    return response.data;
  } catch (error) {
    console.error("Delhivery Pickup Error:", error.message);
    // Log but don't throw to avoid breaking the payment confirmation flow
    return { error: error.message };
  }
};

/**
 * Tracks a shipment using the generated AWB
 * @param {String} awbNumber - The Airway bill tracking number
 * @returns {Object} - Tracking history
 */
const trackShipment = async (awbNumber) => {
  try {
    if (!process.env.DELHIVERY_TOKEN || awbNumber.startsWith('MOCK_AWB_')) {
      return { 
        status: "In Transit", 
        scans: [
           { date: new Date(), location: "Dehradun", status: "Picked Up" }
        ] 
      };
    }

    const response = await axios.get(`${BASE_URL}/api/v1/packages/json/?waybill=${awbNumber}`, { headers: HEADERS });
    
    return response.data;
  } catch (error) {
    console.error("Delhivery Tracking Error:", error.message);
    throw new Error('Tracking Failed: ' + error.message);
  }
};

module.exports = {
  createShipment,
  schedulePickup,
  trackShipment
};
