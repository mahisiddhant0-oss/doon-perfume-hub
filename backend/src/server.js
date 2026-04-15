require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('mongo-sanitize');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const logisticsRoutes = require('./routes/logisticsRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');

const app = express();

// --- Global Security Middleware ---
app.use(helmet()); // Set secure HTTP headers
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
})); // Enable CORS with production safety
app.use(xss()); // Prevent XSS attacks

// Sanitize NoSQL Injection
app.use((req, res, next) => {
  req.body = mongoSanitize(req.body);
  req.query = mongoSanitize(req.query);
  req.params = mongoSanitize(req.params);
  next();
});

// Global Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api', limiter);


// Middleware
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Database Connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/doonperfumehub');
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        console.warn('WARNING: Running without MongoDB connection. Database features will fail.');
        // process.exit(1); // Do not exit so the server can still run for other features/health checks
    }
};

connectDB();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/logistics', logisticsRoutes);
app.use('/api/webhooks', webhookRoutes);

app.get('/', (req, res) => {
    res.send('API is running...');
});

// --- Final Middleware ---
app.use(notFound); // Catch 404s
app.use(errorHandler); // Global Error Handler

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
