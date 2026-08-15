const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const createRateLimiter = require('../middleware/rateLimiter');

// Password Auth
router.post('/register', createRateLimiter(5, 60), authController.register);
router.post('/login', createRateLimiter(10, 60), authController.login);
router.post('/logout', authController.logout);
router.get('/me', authenticateToken, authController.me);

// WebAuthn Passkey Endpoints
router.post('/webauthn/register-options', authenticateToken, authController.generateWebAuthnRegisterOpts);
router.post('/webauthn/register-verify', authenticateToken, authController.verifyWebAuthnRegistration);
router.post('/webauthn/auth-options', authenticateToken, authController.generateWebAuthnAuthOpts);
router.post('/webauthn/auth-verify', authenticateToken, authController.verifyWebAuthnAuthentication);

module.exports = router;
