require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('mongo-sanitize');
const rateLimit = require('express-rate-limit');
const { getAllowedOrigins, getPrimaryFrontendUrl, isOriginAllowed, isProduction, validateEnv } = require('./config/env');
const Order = require('./models/Order');
const Counter = require('./models/Counter');
const { upsertSpecialEnquiryProducts } = require('./services/specialEnquiryProducts');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const logisticsRoutes = require('./routes/logisticsRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const enquiryRoutes = require('./routes/enquiryRoutes');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');

validateEnv();

const app = express();
const allowedOrigins = getAllowedOrigins();

app.disable('x-powered-by');

if (process.env.TRUST_PROXY === 'true' || isProduction) {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: isProduction,
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || isOriginAllowed(origin, allowedOrigins)) {
        return callback(null, true);
      }

      return callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use((req, res, next) => {
  req.body = mongoSanitize(req.body);
  req.query = mongoSanitize(req.query);
  req.params = mongoSanitize(req.params);
  next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use('/api', limiter);

app.get('/health', (req, res) => {
  const mongoState = mongoose.connection?.readyState;
  const dbStatus =
    mongoState === 1 ? 'connected' : mongoState === 2 ? 'connecting' : mongoState === 3 ? 'disconnecting' : 'disconnected';

  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    frontendUrl: getPrimaryFrontendUrl() || null,
    database: dbStatus,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/webhooks', express.raw({ type: 'application/json', limit: '100kb' }), webhookRoutes);
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || (!isProduction ? 'mongodb://127.0.0.1:27017/doonperfumehub' : null);

    if (!mongoUri) {
      throw new Error('MONGO_URI is required in production');
    }

    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    console.warn('WARNING: Running without MongoDB connection. Database features will fail.');
  }
};

connectDB();

const reconcileOrderCodes = async () => {
  try {
    if (mongoose.connection?.readyState !== 1) return;

    const orders = await Order.find({}).sort({ createdAt: 1, _id: 1 }).select('_id orderCode');
    if (orders.length === 0) {
      await Counter.findOneAndUpdate(
        { key: 'order' },
        { $set: { key: 'order', seq: 1000 } },
        { upsert: true, new: true }
      );
      return;
    }

    let sequence = 1000;
    let updatedCount = 0;
    for (const order of orders) {
      sequence += 1;
      const expectedCode = `DPH#${sequence}`;
      if (order.orderCode !== expectedCode) {
        await Order.updateOne({ _id: order._id }, { $set: { orderCode: expectedCode } });
        updatedCount += 1;
      }
    }

    await Counter.findOneAndUpdate(
      { key: 'order' },
      { $set: { key: 'order', seq: sequence } },
      { upsert: true, new: true }
    );

    console.log(`Reconciled order codes. Updated ${updatedCount} of ${orders.length} order(s). Next sequence: ${sequence + 1}`);
  } catch (error) {
    console.error('Order code reconciliation failed:', error.message);
  }
};

const seedSpecialEnquiryCatalog = async () => {
  try {
    if (mongoose.connection?.readyState !== 1) return;
    const result = await upsertSpecialEnquiryProducts();
    console.log(
      `Special enquiry products sync completed. Created ${result.created}, Updated ${result.updated}, Total ${result.total}`
    );
  } catch (error) {
    console.error('Special enquiry products sync failed:', error.message);
  }
};

setTimeout(() => {
  reconcileOrderCodes();
  seedSpecialEnquiryCatalog();
}, 5000);

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/enquiries', enquiryRoutes);

app.get('/', (req, res) => {
  res.send('API is running...');
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
