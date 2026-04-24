/**
 * @desc    Standardized Error Handling Middleware
 */

const notFound = (req, res, next) => {
  const error = new Error(`Resource Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);

  res.status(statusCode);

  const response = {
    message: err.message,
    ...(process.env.NODE_ENV === 'production' ? {} : { stack: err.stack }),
  };

  if (err.name === 'ValidationError') {
    res.status(400);
    response.message = Object.values(err.errors).map((val) => val.message).join(', ');
  }

  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    res.status(404);
    response.message = 'Resource not found: Invalid ID format';
  }

  res.json(response);
};

module.exports = { notFound, errorHandler };
