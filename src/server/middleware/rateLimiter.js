const cache = require('../utils/cache');

/**
 * Express sliding-window rate limiter
 * @param {number} maxRequests Max allowed requests in window
 * @param {number} windowSeconds Window duration in seconds
 */
function createRateLimiter(maxRequests = 10, windowSeconds = 60) {
  return (req, res, next) => {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const route = req.originalUrl || req.url;
    const key = `rate:${clientIp}:${route}`;

    const currentCount = cache.get(key) || 0;

    if (currentCount >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests. Rate limit exceeded. Please try again later.'
      });
    }

    cache.set(key, currentCount + 1, windowSeconds);
    next();
  };
}

module.exports = createRateLimiter;
