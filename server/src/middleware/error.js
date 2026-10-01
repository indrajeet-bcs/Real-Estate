import { ApiError } from '../utils/ApiError.js'
import { isProd } from '../config/env.js'

// 404 for unmatched routes.
export function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`))
}

// Central error handler — converts known error shapes into the response envelope.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let statusCode = err.statusCode || 500
  let message = err.message || 'Internal server error'
  let details = err.details

  // Mongoose validation
  if (err.name === 'ValidationError') {
    statusCode = 400
    message = 'Validation failed'
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }))
  }

  // Duplicate key
  if (err.code === 11000) {
    statusCode = 409
    const field = Object.keys(err.keyValue || {})[0]
    message = `Duplicate value for ${field || 'a unique field'}`
    details = err.keyValue
  }

  // Invalid ObjectId
  if (err.name === 'CastError') {
    statusCode = 400
    message = `Invalid ${err.path}: ${err.value}`
  }

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err)
  }

  res.status(statusCode).json({
    success: false,
    message,
    details,
    ...(isProd ? {} : { stack: err.stack }),
  })
}
