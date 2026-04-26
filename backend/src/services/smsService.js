const https = require('https');

const isProduction = process.env.NODE_ENV === 'production';
const getSmsProvider = () => String(process.env.SMS_PROVIDER || 'msg91').trim().toLowerCase();
const getMsg91AuthKey = () => String(process.env.MSG91_AUTH_KEY || '').trim();
const getMsg91SenderId = () => String(process.env.MSG91_SENDER_ID || '').trim();
const getMsg91Route = () => String(process.env.MSG91_ROUTE || '4').trim();
const getMsg91CountryCode = () => String(process.env.MSG91_COUNTRY || '91').trim();
const getMsg91EntityId = () => String(process.env.MSG91_ENTITY_ID || '').trim();
const getMsg91OrderTemplateId = () => String(process.env.MSG91_ORDER_TEMPLATE_ID || '').trim();
const getMsg91ShippingTemplateId = () => String(process.env.MSG91_SHIPPING_TEMPLATE_ID || '').trim();
const getMsg91OtpMessageTemplate = () =>
  String(process.env.MSG91_OTP_MESSAGE_TEMPLATE || 'Your OTP is ##OTP##.').trim();
const hasPlaceholder = (value = '') => /replace_with_/i.test(String(value));

const normalizePhoneForMsg91 = (phone = '') => {
  const digits = String(phone).replace(/\D/g, '');

  if (/^\d{10}$/.test(digits)) {
    return `91${digits}`;
  }

  if (/^91\d{10}$/.test(digits)) {
    return digits;
  }

  return digits;
};

const msg91Get = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          try {
            resolve(JSON.parse(data || '{}'));
          } catch (parseError) {
            resolve({ raw: String(data || '').trim() });
          }
        });
      })
      .on('error', reject);
  });

const isMsg91Success = (response = {}) => {
  const responseType = String(response.type || '').toLowerCase();
  if (responseType === 'success') {
    return true;
  }

  const raw = String(response.raw || '').toLowerCase();
  return raw.includes('success') || raw.includes('sent');
};

const sendOtpViaMsg91 = async (phone, otp) => {
  const authKey = getMsg91AuthKey();
  const senderId = getMsg91SenderId();
  const mobile = normalizePhoneForMsg91(phone);

  if (!authKey || !senderId || hasPlaceholder(authKey) || hasPlaceholder(senderId)) {
    return { error: 'MSG91 is not configured. Set MSG91_AUTH_KEY and MSG91_SENDER_ID.' };
  }

  let messageTemplate = getMsg91OtpMessageTemplate();
  if (!/otp/i.test(messageTemplate)) {
    messageTemplate = `Your OTP is ##OTP##. ${messageTemplate}`;
  }

  const message = messageTemplate.includes('##OTP##')
    ? messageTemplate.replace(/##OTP##/g, otp)
    : `${messageTemplate} OTP: ${otp}`;
  const query = new URLSearchParams({
    authkey: authKey,
    mobile,
    message,
    sender: senderId,
    otp,
    otp_expiry: '10',
  });

  const url = `https://api.msg91.com/api/sendotp.php?${query.toString()}`;

  try {
    const response = await msg91Get(url);
    if (!isMsg91Success(response)) {
      return { error: response.message || 'MSG91 failed to send OTP' };
    }

    return response;
  } catch (error) {
    return { error: `MSG91 request failed: ${error.message}` };
  }
};

const sendSmsViaMsg91 = async (phone, body, templateId = '') => {
  const authKey = getMsg91AuthKey();
  const senderId = getMsg91SenderId();
  const mobile = normalizePhoneForMsg91(phone);

  if (!authKey || !senderId || hasPlaceholder(authKey) || hasPlaceholder(senderId)) {
    return { error: 'MSG91 is not configured. Set MSG91_AUTH_KEY and MSG91_SENDER_ID.' };
  }

  const query = new URLSearchParams({
    authkey: authKey,
    mobiles: mobile,
    message: body,
    sender: senderId,
    route: getMsg91Route(),
    country: getMsg91CountryCode(),
  });

  const entityId = getMsg91EntityId();
  if (entityId) {
    query.append('entity_id', entityId);
  }

  if (templateId) {
    query.append('DLT_TE_ID', templateId);
  }

  const url = `https://api.msg91.com/api/sendhttp.php?${query.toString()}`;

  try {
    const response = await msg91Get(url);
    if (!isMsg91Success(response)) {
      return { error: response.message || response.raw || 'MSG91 failed to send SMS' };
    }

    return response;
  } catch (error) {
    return { error: `MSG91 request failed: ${error.message}` };
  }
};

const sendSMS = async (to, body) => {
  const response = await sendSmsViaMsg91(to, body);
  if (!response?.error) {
    console.log(`SMS sent successfully via MSG91 to ${to}`);
    return response;
  }

  if (!isProduction) {
    console.log(`[DEV][SMS][MSG91_FALLBACK] To: ${to} | Message: ${body}`);
    return { mock: true };
  }

  return response;
};

const sendOrderConfirmationSMS = async (order, phone) => {
  const message = `Order Confirmed! Your order #${order._id.toString().slice(-6)} for Rs.${order.totalAmount} at DOON PERFUME HUB is being processed. Thank you!`;
  return sendSmsViaMsg91(phone, message, getMsg91OrderTemplateId());
};

const sendShippingSMS = async (order, phone) => {
  if (!order.awbNumber) return null;
  const message = `Great news! Your DOON PERFUME HUB order #${order._id.toString().slice(-6)} has been shipped. Tracking (AWB): ${order.awbNumber}. Track via Delhivery.`;
  return sendSmsViaMsg91(phone, message, getMsg91ShippingTemplateId());
};

const sendOTPSMS = async (phone, otp) => {
  const provider = getSmsProvider();
  if (provider !== 'msg91') {
    return { error: `Unsupported SMS_PROVIDER '${provider}'. Set SMS_PROVIDER=msg91.` };
  }

  return sendOtpViaMsg91(phone, otp);
};

module.exports = {
  sendSMS,
  sendOrderConfirmationSMS,
  sendShippingSMS,
  sendOTPSMS,
};
