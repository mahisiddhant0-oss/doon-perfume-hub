const twilio = require('twilio');

// Initialize Twilio client
// Only initialize if credentials are provided to avoid startup errors in DEV
let client;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

/**
 * @desc    Send a generic SMS via Twilio
 * @param {String} to - Recipient phone number (with country code, e.g. +91...)
 * @param {String} body - Message content
 */
const sendSMS = async (to, body) => {
  try {
    if (!client || !process.env.TWILIO_PHONE_NUMBER) {
      console.log(`📱 [DEV][SMS] To: ${to} | Message: ${body}`);
      return { sid: `MOCK_SID_${Date.now()}` };
    }

    const message = await client.messages.create({
      body: body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });

    console.log(`✉️ SMS sent successfully. SID: ${message.sid}`);
    return message;
  } catch (error) {
    console.error('❌ Twilio SMS Error:', error.message);
    // We log the error but don't throw to avoid breaking the main business flow
    return { error: error.message };
  }
};

/**
 * @desc    Send Order Confirmation SMS
 */
const sendOrderConfirmationSMS = async (order, phone) => {
  const message = `Order Confirmed! Your order #${order._id.toString().slice(-6)} for ₹${order.totalAmount} at DOON PERFUME HUB is being processed. Thank you!`;
  return await sendSMS(phone, message);
};

/**
 * @desc    Send Shipping/Tracking SMS
 */
const sendShippingSMS = async (order, phone) => {
  if (!order.awbNumber) return;
  const message = `Great news! Your DOON PERFUME HUB order #${order._id.toString().slice(-6)} has been shipped. Tracking (AWB): ${order.awbNumber}. Track via Delhivery.`;
  return await sendSMS(phone, message);
};

/**
 * @desc    Send OTP SMS
 */
const sendOTPSMS = async (phone, otp) => {
  const message = `${otp} is your DOON PERFUME HUB verification code. Valid for 10 minutes. Do not share it with anyone.`;
  return await sendSMS(phone, message);
};

module.exports = {
  sendSMS,
  sendOrderConfirmationSMS,
  sendShippingSMS,
  sendOTPSMS
};
