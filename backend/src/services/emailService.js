const nodemailer = require('nodemailer');
const dns = require('dns');
const emailNotificationsEnabled = String(process.env.EMAIL_NOTIFICATIONS_ENABLED || '').toLowerCase() === 'true';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {
  // Ignore when runtime doesn't support this API.
}

const resolveFromAddress = (fallbackLabel = 'DOON PERFUME HUB') => {
  const configured = String(process.env.SMTP_FROM_EMAIL || '').trim();
  if (!configured) {
    return fallbackLabel;
  }

  if (configured.includes('<') || configured.includes('@')) {
    return configured;
  }

  return `"${fallbackLabel}" <${configured}>`;
};

const SMTP_CONNECTION_TIMEOUT_MS = Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 5000);
const SMTP_GREETING_TIMEOUT_MS = Number(process.env.SMTP_GREETING_TIMEOUT_MS || 5000);
const SMTP_SOCKET_TIMEOUT_MS = Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 7000);

const getSmtpCandidates = () => {
  const host = String(process.env.SMTP_HOST || 'smtp.gmail.com').trim() || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const base = [{ host, port, secure: port === 465 }];

  const dedup = [];
  const seen = new Set();
  for (const item of base) {
    const key = `${item.host}:${item.port}:${item.secure}`;
    if (!seen.has(key)) {
      seen.add(key);
      dedup.push(item);
    }
  }
  return dedup;
};

const resolveHostForSmtp = async (host) => {
  try {
    const addresses = await dns.promises.resolve4(host);
    if (addresses && addresses.length > 0) {
      return { address: addresses[0], servername: host };
    }
    return { address: host, servername: host };
  } catch {
    return { address: host, servername: host };
  }
};

const createSmtpTransporter = async ({ host, port, secure }) => {
  const { address, servername } = await resolveHostForSmtp(host);
  return nodemailer.createTransport({
    host: address,
    port,
    secure,
    requireTLS: !secure,
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { servername },
  });
};

const sendMailWithFallback = async (mailOptions) => {
  const candidates = getSmtpCandidates();
  const errors = [];

  for (const candidate of candidates) {
    try {
      const transporter = await createSmtpTransporter(candidate);
      return await transporter.sendMail(mailOptions);
    } catch (error) {
      errors.push(`${candidate.host}:${candidate.port} ${error.message}`);
    }
  }

  throw new Error(errors.join(' | '));
};

const isSmtpConfigured = () =>
  Boolean(
      String(process.env.SMTP_USER || '').trim() &&
      String(process.env.SMTP_PASS || '').trim()
  );

/**
 * @desc    Generate professional HTML template for order confirmation
 * @param {Object} order - Full mongoose Order object
 * @returns {String} - HTML string
 */
const getOrderEmailTemplate = (order, isAdmin = false) => {
  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #333; color: #fff;">${item.name} x ${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #333; text-align: right; color: #D4AF37;">₹${item.price * item.quantity}</td>
    </tr>
  `).join('');

  const title = isAdmin ? 'New Order Received' : 'Order Confirmation';
  const subtitle = isAdmin 
    ? `You have a new order (#${order._id}) for DOON PERFUME HUB.` 
    : `Thank you for your purchase from DOON PERFUME HUB. Your order is being processed.`;

  return `
    <div style="background-color: #000; color: #fff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; border: 2px solid #D4AF37; max-width: 600px; margin: auto;">
      <div style="text-align: center; padding-bottom: 20px;">
        <h1 style="color: #D4AF37; margin: 0; font-size: 28px; letter-spacing: 2px;">DOON PERFUME HUB</h1>
        <p style="color: #888; font-size: 14px; text-transform: uppercase;">Exquisite Scents. Timeless Luxury.</p>
      </div>

      <div style="background-color: #111; padding: 20px; border-radius: 8px;">
        <h2 style="color: #D4AF37; margin-bottom: 10px;">${title}</h2>
        <p style="color: #ccc; line-height: 1.6;">${subtitle}</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="border-bottom: 2px solid #D4AF37;">
              <th style="padding: 10px; text-align: left; color: #D4AF37;">Item</th>
              <th style="padding: 10px; text-align: right; color: #D4AF37;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <th style="padding: 15px 10px; text-align: left; color: #D4AF37; font-size: 18px;">Total</th>
              <th style="padding: 15px 10px; text-align: right; color: #D4AF37; font-size: 18px;">₹${order.totalAmount}</th>
            </tr>
          </tfoot>
        </table>

        <div style="margin-top: 20px;">
          <h3 style="color: #D4AF37; margin-bottom: 5px;">Shipping Address</h3>
          <p style="color: #ccc; margin: 0; font-size: 14px;">
            ${order.shippingAddress.firstName} ${order.shippingAddress.lastName}<br>
            ${order.shippingAddress.street}, ${order.shippingAddress.city}<br>
            ${order.shippingAddress.state}, ${order.shippingAddress.pincode}<br>
            Phone: ${order.shippingAddress.phone}
          </p>
        </div>

        ${order.awbNumber ? `
          <div style="margin-top: 20px; padding: 15px; border: 1px dashed #D4AF37; border-radius: 4px; text-align: center;">
            <p style="color: #D4AF37; margin: 0; font-weight: bold;">Waybill (AWB): ${order.awbNumber}</p>
            <p style="color: #888; font-size: 12px;">Track your package via Delhivery</p>
          </div>
        ` : ''}
      </div>

      <div style="text-align: center; padding-top: 20px; color: #888; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} DOON PERFUME HUB. All rights reserved.</p>
        <p>This is an automated message. Please do not reply directly to this email.</p>
      </div>
    </div>
  `;
};

/**
 * @desc    Send Order Confirmation Email to Customer
 */
const sendOrderConfirmation = async (order, userEmail) => {
  try {
    if (!emailNotificationsEnabled) {
      console.log('Email notifications disabled. Skipping customer confirmation email.');
      return;
    }

    if (!userEmail) {
      console.warn('⚠️ No user email found. Skipping order confirmation email.');
      return;
    }

    const mailOptions = {
      from: resolveFromAddress('DOON PERFUME HUB'),
      to: userEmail,
      subject: `Order Received! #${order._id}`,
      html: getOrderEmailTemplate(order, false),
    };

    await sendMailWithFallback(mailOptions);
    console.log('✉️ Order confirmation email sent to:', userEmail);
  } catch (error) {
    console.error('❌ Error sending confirmation email:', error.message);
  }
};

/**
 * @desc    Send New Order Alert to Admin
 */
const sendAdminNewOrderAlert = async (order) => {
  try {
    if (!emailNotificationsEnabled) {
      console.log('Email notifications disabled. Skipping admin order alert email.');
      return;
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.warn('⚠️ ADMIN_EMAIL not set in .env. Skipping admin alert.');
      return;
    }

    const mailOptions = {
      from: resolveFromAddress('DOON PERFUME HUB LOGS'),
      to: adminEmail,
      subject: `🔥 NEW ORDER ALERT! #${order._id}`,
      html: getOrderEmailTemplate(order, true),
    };

    await sendMailWithFallback(mailOptions);
    console.log('✉️ Admin order alert sent to:', adminEmail);
  } catch (error) {
    console.error('❌ Error sending admin notification email:', error.message);
  }
};

/**
 * @desc    Send Login OTP Email to customer
 */
const sendLoginOtpEmail = async ({ email, otp, name }) => {
  try {
    if (!email) {
      return { error: 'Email is required for OTP delivery.' };
    }

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
        <div style="background: #0b4ea2; color: #ffffff; padding: 18px 20px;">
          <h2 style="margin: 0; font-size: 20px;">DOON PERFUME HUB</h2>
        </div>
        <div style="padding: 20px; color: #111827;">
          <p style="margin-top: 0;">Hi ${name || 'there'},</p>
          <p>Your one-time login code is:</p>
          <div style="font-size: 32px; letter-spacing: 6px; font-weight: 700; color: #0b4ea2; margin: 16px 0;">${otp}</div>
          <p>This OTP is valid for 10 minutes.</p>
          <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">If you did not request this, please ignore this email.</p>
        </div>
      </div>
    `;

    const subject = 'Your DOON PERFUME HUB Login OTP';

    await sendMailWithFallback({
      from: resolveFromAddress('DOON PERFUME HUB'),
      to: email,
      subject,
      html,
    });

    return { success: true };
  } catch (error) {
    return { error: error.message || 'Failed to send OTP email' };
  }
};

const sendPriceEnquiryAlert = async ({ productName, sku, productId, customerName, phone }) => {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP is not configured. Unable to deliver enquiry email.');
  }

  const recipient = String(process.env.ADMIN_EMAIL || '').trim() || 'doonperfumehub@gmail.com';
  const subject = `Price Enquiry: ${productName || 'Special Product'}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
      <div style="background: #0b4ea2; color: #ffffff; padding: 16px 20px;">
        <h2 style="margin: 0; font-size: 20px;">DOON PERFUME HUB - Price Enquiry</h2>
      </div>
      <div style="padding: 20px; color: #111827;">
        <p style="margin-top: 0;">A customer requested the best price for an enquiry-only product.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 14px;">
          <tr><td style="padding: 8px 0; color: #6b7280;">Product</td><td style="padding: 8px 0; font-weight: 600;">${productName || '-'}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">SKU</td><td style="padding: 8px 0; font-weight: 600;">${sku || '-'}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Product ID</td><td style="padding: 8px 0; font-weight: 600;">${productId || '-'}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Customer Name</td><td style="padding: 8px 0; font-weight: 600;">${customerName || '-'}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Phone Number</td><td style="padding: 8px 0; font-weight: 600;">${phone || '-'}</td></tr>
        </table>
      </div>
    </div>
  `;

  await sendMailWithFallback({
    from: resolveFromAddress('DOON PERFUME HUB'),
    to: recipient,
    subject,
    html,
  });
};

module.exports = {
  sendOrderConfirmation,
  sendAdminNewOrderAlert,
  sendLoginOtpEmail,
  sendPriceEnquiryAlert,
};
