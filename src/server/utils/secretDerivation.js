const crypto = require('crypto');
const config = require('../config');
const cache = require('./cache');

/**
 * Derives session-specific HMAC key K_session from Master Secret
 */
function deriveSessionKey(sessionId) {
  const cacheKey = `session:key:${sessionId}`;
  const cachedKey = cache.get(cacheKey);
  if (cachedKey) return cachedKey;

  const sessionKey = crypto
    .createHmac('sha256', config.MASTER_HMAC_SECRET)
    .update(`session:${sessionId}`)
    .digest('hex');

  // Cache key for 30 minutes
  cache.set(cacheKey, sessionKey, 1800);
  return sessionKey;
}

/**
 * Gets current 3-second server epoch
 */
function getCurrentEpoch() {
  return Math.floor(Date.now() / 3000);
}

/**
 * Generates a signed short-lived dynamic QR token for the projector stream
 */
function generateDynamicToken(sessionId, nonce = null) {
  const sessionKey = deriveSessionKey(sessionId);
  const epoch = getCurrentEpoch();
  const tokenNonce = nonce || crypto.randomBytes(4).toString('hex');

  const payload = `${sessionId}:${epoch}:${tokenNonce}`;
  const signature = crypto
    .createHmac('sha256', sessionKey)
    .update(payload)
    .digest('hex');

  return `${sessionId}.${epoch}.${tokenNonce}.${signature}`;
}

/**
 * Verifies a dynamic QR token submitted by a student
 * Accepts tokens from epoch_current and epoch_current - 1 (6-second total window tolerance)
 */
function verifyDynamicToken(tokenString) {
  if (!tokenString || typeof tokenString !== 'string') {
    return { valid: false, reason: 'Invalid token format' };
  }

  const parts = tokenString.split('.');
  if (parts.length !== 4) {
    return { valid: false, reason: 'Malformed token payload' };
  }

  const [sessionId, tokenEpochStr, nonce, clientSignature] = parts;
  const tokenEpoch = parseInt(tokenEpochStr, 10);
  if (isNaN(tokenEpoch)) {
    return { valid: false, reason: 'Invalid token epoch format' };
  }

  const currentEpoch = getCurrentEpoch();

  // Accept current epoch or previous epoch (3s rotation + 3s buffer)
  if (tokenEpoch !== currentEpoch && tokenEpoch !== currentEpoch - 1) {
    return { valid: false, reason: 'Token expired (stale epoch)' };
  }

  const sessionKey = deriveSessionKey(sessionId);
  const payload = `${sessionId}:${tokenEpoch}:${nonce}`;
  const expectedSignature = crypto
    .createHmac('sha256', sessionKey)
    .update(payload)
    .digest('hex');

  // Constant-time comparison
  const expectedBuf = Buffer.from(expectedSignature, 'hex');
  const clientBuf = Buffer.from(clientSignature, 'hex');

  if (expectedBuf.length !== clientBuf.length || !crypto.timingSafeEqual(expectedBuf, clientBuf)) {
    return { valid: false, reason: 'Invalid cryptographic signature' };
  }

  return {
    valid: true,
    sessionId,
    epoch: tokenEpoch,
    nonce
  };
}

module.exports = {
  deriveSessionKey,
  getCurrentEpoch,
  generateDynamicToken,
  verifyDynamicToken
};
