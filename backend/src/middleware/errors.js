// src/middleware/errors.js — Centralized error classes & handler
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

class NotFoundError extends ApiError {
  constructor(msg = 'Resource not found') {
    super(404, msg);
  }
}

class BadRequestError extends ApiError {
  constructor(msg = 'Bad request') {
    super(400, msg);
  }
}

class UnauthorizedError extends ApiError {
  constructor(msg = 'Unauthorized') {
    super(401, msg);
  }
}

class ForbiddenError extends ApiError {
  constructor(msg = 'Forbidden') {
    super(403, msg);
  }
}

class ConflictError extends ApiError {
  constructor(msg = 'Conflict') {
    super(409, msg);
  }
}

function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  if (status >= 500) {
    console.error(`[ERROR 500] ${req.method} ${req.path}:`, err);
  }

  res.status(status).json({
    success: false,
    message,
  });
}

module.exports = {
  ApiError,
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  errorHandler,
};
