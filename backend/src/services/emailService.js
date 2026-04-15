const nodemailer = require('nodemailer');

// Setup SMTP transporter with environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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
    if (!userEmail) {
      console.warn('⚠️ No user email found. Skipping order confirmation email.');
      return;
    }

    const mailOptions = {
      from: `"DOON PERFUME HUB" <${process.env.SMTP_FROM_EMAIL}>`,
      to: userEmail,
      subject: `Order Recieved! #${order._id}`,
      html: getOrderEmailTemplate(order, false),
    };

    await transporter.sendMail(mailOptions);
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
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      console.warn('⚠️ ADMIN_EMAIL not set in .env. Skipping admin alert.');
      return;
    }

    const mailOptions = {
      from: `"DOON PERFUME HUB LOGS" <${process.env.SMTP_FROM_EMAIL}>`,
      to: adminEmail,
      subject: `🔥 NEW ORDER ALERT! #${order._id}`,
      html: getOrderEmailTemplate(order, true),
    };

    await transporter.sendMail(mailOptions);
    console.log('✉️ Admin order alert sent to:', adminEmail);
  } catch (error) {
    console.error('❌ Error sending admin notification email:', error.message);
  }
};

module.exports = {
  sendOrderConfirmation,
  sendAdminNewOrderAlert
};
