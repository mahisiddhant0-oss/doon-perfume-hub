// Delhivery API documentation: https://www.delhivery.com/support/

const axios = require('axios');

// For staging/testing, we use the test URL. Change to production in production environment.
const BASE_URL = process.env.DELHIVERY_ENVIRONMENT === 'production' 
  ? 'https://track.delhivery.com' 
  : 'https://staging-express.delhivery.com';

const AUTH_HEADERS = {
  Authorization: `Token ${process.env.DELHIVERY_TOKEN || 'TEST_TOKEN'}`,
};

const getPickupLocationName = () =>
  (process.env.DELHIVERY_PICKUP_LOCATION || process.env.DELHIVERY_WAREHOUSE_NAME || '').trim();

const buildDelhiveryError = (error, fallback = 'Delhivery request failed') => {
  const apiMessage =
    error?.response?.data?.remarks ||
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.response?.data?.detail ||
    error?.message;

  return apiMessage ? `${fallback}: ${apiMessage}` : fallback;
};

/**
 * Creates a shipment and generates an AWB
 * @param {Object} order - Full mongoose Order object
 * @returns {Object} - Contains AWB details
 */
const createShipment = async (order) => {
  try {
    const pickupLocationName = getPickupLocationName();
    if (!pickupLocationName) {
      throw new Error('Missing DELHIVERY_PICKUP_LOCATION env var');
    }

    // We map our system's Order data into Delhivery's extremely specific 'format: json' payload string requirement
    const payload = {
      shipments: [
        {
          name: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`.trim(),
          add: order.shippingAddress.street + (order.shippingAddress.apartment ? `, ${order.shippingAddress.apartment}` : ''),
          pin: String(order.shippingAddress.pincode),
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          country: 'India',
          phone: String(order.shippingAddress.phone),
          order: order._id.toString(),
          payment_mode: 'Pre-paid',
          return_pin: process.env.DELHIVERY_RETURN_PIN || '248001',
          return_city: process.env.DELHIVERY_RETURN_CITY || 'Dehradun',
          return_phone: process.env.DELHIVERY_RETURN_PHONE || '9876543210',
          return_add: process.env.DELHIVERY_RETURN_ADDRESS || 'Doon Perfume Hub Storage, Dehradun',
          return_state: process.env.DELHIVERY_RETURN_STATE || 'Uttarakhand',
          return_country: 'India',
          products_desc: order.items.map((i) => i.name).join(', '),
          cod_amount: '0',
          total_amount: Number(order.totalAmount || 0).toFixed(2),
          seller_inv: `INV-${order._id.toString()}`,
          quantity: String(order.items.reduce((acc, curr) => acc + curr.quantity, 0)),
          waybill: '',
        },
      ],
      pickup_location: {
        name: pickupLocationName,
      },
    };

    // Note: If no token is provided in the .env, we assume this is a DEV run and mock the response
    if (!process.env.DELHIVERY_TOKEN) {
      console.log('📦 [DEV] Mocking Delhivery AWB Generation for Order:', order._id);
      return { status: 200, awbNumber: `MOCK_AWB_${Date.now()}` };
    }

    const form = new URLSearchParams({
      format: 'json',
      data: JSON.stringify(payload),
    });

    const response = await axios.post(`${BASE_URL}/api/cmu/create.json`, form.toString(), {
      headers: {
        ...AUTH_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 30000,
    });

    if (response.data.success) {
       return { 
         status: 200, 
         awbNumber: response.data.packages[0].waybill 
       };
    } else {
       throw new Error(response.data?.error || response.data?.remarks || 'Failed to generate AWB');
    }

  } catch (error) {
    console.error('Delhivery API Error (createShipment):', error?.response?.data || error.message);
    throw new Error(buildDelhiveryError(error, 'Logistics Integration Failed'));
  }
};

/**
 * Schedules a pickup request with Delhivery
 * @param {Object} order - Full mongoose Order object
 * @returns {Object} - Pickup request status
 */
const schedulePickup = async (order) => {
  try {
    const pickupLocationName = getPickupLocationName();
    if (!pickupLocationName) {
      throw new Error('Missing DELHIVERY_PICKUP_LOCATION env var');
    }

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
      pickup_location: pickupLocationName,
      expected_package_count: order.items.reduce((acc, curr) => acc + curr.quantity, 0)
    };

    if (!process.env.DELHIVERY_TOKEN || order.awbNumber.startsWith('MOCK_AWB_')) {
      console.log('📦 [DEV] Mocking Delhivery Pickup Request for Order:', order._id, 'on', dateStr);
      return { status: 200, message: "Pickup scheduled (MOCK)" };
    }

    const response = await axios.post(`${BASE_URL}/fm/request/new/`, payload, {
      headers: {
        ...AUTH_HEADERS,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    return response.data;
  } catch (error) {
    console.error('Delhivery Pickup Error:', error?.response?.data || error.message);
    // Log but don't throw to avoid breaking the payment confirmation flow
    return { error: buildDelhiveryError(error, 'Pickup scheduling failed') };
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

    const response = await axios.get(`${BASE_URL}/api/v1/packages/json/?waybill=${awbNumber}`, {
      headers: AUTH_HEADERS,
      timeout: 30000,
    });
    
    return response.data;
  } catch (error) {
    console.error('Delhivery Tracking Error:', error?.response?.data || error.message);
    throw new Error(buildDelhiveryError(error, 'Tracking Failed'));
  }
};

module.exports = {
  createShipment,
  schedulePickup,
  trackShipment
};
