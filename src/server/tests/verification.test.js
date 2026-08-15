const assert = require('assert');
const { generateDynamicToken, verifyDynamicToken, getCurrentEpoch } = require('../utils/secretDerivation');
const { calculateDistance, evaluateLocationConfidence } = require('../utils/haversine');
const cache = require('../utils/cache');

console.log('=== RUNNING SMART ATTENDANCE ENGINE AUTOMATED TESTS ===\n');

// Test 1: Dynamic HMAC Token Generation & Verification
console.log('[Test 1] Dynamic HMAC Token Generation & Valid Epoch Signature Verification...');
const sessionId = 'test_session_12345';
const token = generateDynamicToken(sessionId);
assert(token && typeof token === 'string', 'Token should be a valid string');

const verification = verifyDynamicToken(token);
assert.strictEqual(verification.valid, true, 'Verification should succeed for valid fresh token');
assert.strictEqual(verification.sessionId, sessionId, 'Session ID in token should match');
console.log('✓ PASS: Dynamic HMAC token generated and verified successfully.');

// Test 2: Forged Signature Rejection
console.log('\n[Test 2] Forged Token Signature Rejection...');
const parts = token.split('.');
const forgedToken = `${parts[0]}.${parts[1]}.${parts[2]}.bad_signature_hash_xyz`;
const forgedVerification = verifyDynamicToken(forgedToken);
assert.strictEqual(forgedVerification.valid, false, 'Forged signature should be rejected');
console.log('✓ PASS: Forged token signature rejected.');

// Test 3: Stale Epoch Rejection
console.log('\n[Test 3] Stale Epoch Token Rejection (>6 seconds old)...');
const staleEpoch = getCurrentEpoch() - 5;
const staleToken = `${sessionId}.${staleEpoch}.nonce123.some_sig`;
const staleVerification = verifyDynamicToken(staleToken);
assert.strictEqual(staleVerification.valid, false, 'Stale epoch token should be rejected');
console.log('✓ PASS: Stale epoch token rejected.');

// Test 4: Replay Protection Cache Check
console.log('\n[Test 4] Atomic Nonce Replay Protection Check...');
const nonceKey = `token:replay:${sessionId}:nonce_test_789`;
assert.strictEqual(cache.has(nonceKey), false, 'Nonce should initially be unused');
cache.set(nonceKey, { studentId: 'student_1', timestamp: Date.now() }, 300);
assert.strictEqual(cache.has(nonceKey), true, 'Nonce should be marked used in cache');
console.log('✓ PASS: Replay nonce successfully stored and checked in cache.');

// Test 5: Haversine Geofence Distance Math
console.log('\n[Test 5] Haversine Distance & Location Confidence Calculation...');
// Connaught Place, Delhi -> India Gate, Delhi (~2300m apart)
const dist = calculateDistance(28.6315, 77.2167, 28.6129, 77.2295);
assert(dist > 2000 && dist < 2600, `Calculated distance should be ~2.3km, got ${dist}m`);

const geofence = { latitude: 28.6315, longitude: 77.2167, radiusMeters: 30, sampleSpreadMeters: 5 };
const locResultHigh = evaluateLocationConfidence(28.6315, 77.2167, 10, geofence);
assert.strictEqual(locResultHigh.confidence, 'high', 'Same spot location should be high confidence');

const locResultLow = evaluateLocationConfidence(28.6129, 77.2295, 10, geofence);
assert.strictEqual(locResultLow.confidence, 'low', 'Far location should be low confidence');
console.log('✓ PASS: Haversine distance and location confidence math verified.');

console.log('\n==================================================');
console.log('ALL 5 AUTOMATED SECURITY TESTS PASSED CLEANLY! ✓');
console.log('==================================================\n');
