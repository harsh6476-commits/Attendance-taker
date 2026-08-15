const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} = require('@simplewebauthn/server');

const config = require('../config');
const cache = require('../utils/cache');
const User = require('../models/User');
const WebAuthnCredential = require('../models/WebAuthnCredential');

function getRequestRPID(req) {
  if (config.RP_ID && config.RP_ID !== 'localhost') return config.RP_ID;
  const host = req.headers.host || 'localhost';
  return host.split(':')[0];
}

function getRequestOrigin(req) {
  if (req.headers.origin) return req.headers.origin;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers.host || 'localhost:5173';
  return `${protocol}://${host}`;
}


/**
 * Standard Password Registration
 */
async function register(req, res) {
  try {
    const { role, name, email, collegeId, password } = req.body;

    if (!role || !name || !email || !collegeId || !password) {
      return res.status(400).json({ error: 'All fields (role, name, email, collegeId, password) are required.' });
    }

    if (!['teacher', 'student'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either teacher or student.' });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { collegeId: collegeId.toUpperCase() }]
    });

    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email or College ID already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = await User.create({
      role,
      name,
      email: email.toLowerCase(),
      collegeId: collegeId.toUpperCase(),
      passwordHash
    });

    const token = jwt.sign({ userId: newUser._id, role: newUser.role }, config.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(201).json({
      message: 'Account registered successfully',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        collegeId: newUser.collegeId,
        role: newUser.role
      },
      token
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Failed to register account' });
  }
}

/**
 * Password Login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, config.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        collegeId: user.collegeId,
        role: user.role
      },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
}

/**
 * Get Current User Details
 */
async function me(req, res) {
  try {
    const credentialsCount = await WebAuthnCredential.countDocuments({ userId: req.user._id });
    return res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        collegeId: req.user.collegeId,
        role: req.user.role,
        hasPasskey: credentialsCount > 0
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
}

/**
 * Logout
 */
function logout(req, res) {
  res.clearCookie('token');
  return res.json({ message: 'Logged out successfully' });
}

/**
 * WebAuthn Passkey Registration Options
 */
async function generateWebAuthnRegisterOpts(req, res) {
  try {
    const userId = req.user._id.toString();
    const existingCredentials = await WebAuthnCredential.find({ userId: req.user._id });

    const options = await generateRegistrationOptions({
      rpName: config.RP_NAME,
      rpID: getRequestRPID(req),
      userID: Buffer.from(userId),
      userName: req.user.email,
      userDisplayName: req.user.name,
      attestationType: 'none',
      excludeCredentials: existingCredentials.map(cred => ({
        id: cred.credentialID,
        type: 'public-key',
        transports: cred.transports
      })),
      authenticatorSelection: {
        userVerification: 'preferred',
        residentKey: 'preferred'
      }
    });

    // Save challenge in cache (10 min TTL)
    cache.set(`webauthn:reg:${userId}`, options.challenge, 600);

    return res.json(options);
  } catch (err) {
    console.error('WebAuthn register opts error:', err);
    return res.status(500).json({ error: 'Failed to generate WebAuthn registration options' });
  }
}

/**
 * WebAuthn Passkey Registration Verification
 */
async function verifyWebAuthnRegistration(req, res) {
  try {
    const userId = req.user._id.toString();
    const expectedChallenge = cache.get(`webauthn:reg:${userId}`);

    if (!expectedChallenge) {
      return res.status(400).json({ error: 'WebAuthn challenge expired or missing. Please try again.' });
    }

    const { response, deviceLabel } = req.body;

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: getRequestOrigin(req),
      expectedRPID: getRequestRPID(req)
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Passkey verification failed.' });
    }

    const { credential, credentialID } = verification.registrationInfo;

    // Save new credential
    await WebAuthnCredential.create({
      userId: req.user._id,
      credentialID: Buffer.from(credential.id).toString('base64url'),
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      deviceLabel: deviceLabel || 'Platform Authenticator',
      transports: response.response.transports || []
    });

    cache.del(`webauthn:reg:${userId}`);

    return res.json({ verified: true, message: 'Passkey registered successfully!' });
  } catch (err) {
    console.error('WebAuthn reg verify error:', err);
    return res.status(500).json({ error: err.message || 'Passkey registration verification failed' });
  }
}

/**
 * WebAuthn Authentication Options
 */
async function generateWebAuthnAuthOpts(req, res) {
  try {
    const userId = req.user._id.toString();
    const userCredentials = await WebAuthnCredential.find({ userId: req.user._id });

    if (userCredentials.length === 0) {
      return res.status(400).json({ error: 'No passkey registered for this account. Please register a passkey first.' });
    }

    const options = await generateAuthenticationOptions({
      rpID: getRequestRPID(req),
      allowCredentials: userCredentials.map(cred => ({
        id: cred.credentialID,
        type: 'public-key',
        transports: cred.transports
      })),
      userVerification: 'required'
    });

    cache.set(`webauthn:auth:${userId}`, options.challenge, 600);

    return res.json(options);
  } catch (err) {
    console.error('WebAuthn auth opts error:', err);
    return res.status(500).json({ error: 'Failed to generate WebAuthn authentication options' });
  }
}

/**
 * WebAuthn Authentication Verification
 */
async function verifyWebAuthnAuthentication(req, res) {
  try {
    const userId = req.user._id.toString();
    const expectedChallenge = cache.get(`webauthn:auth:${userId}`);

    if (!expectedChallenge) {
      return res.status(400).json({ error: 'WebAuthn challenge expired or missing.' });
    }

    const { response } = req.body;
    const credIdBase64 = response.id;

    const dbCredential = await WebAuthnCredential.findOne({ credentialID: credIdBase64, userId: req.user._id });
    if (!dbCredential) {
      return res.status(400).json({ error: 'Unrecognized passkey credential.' });
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: getRequestOrigin(req),
      expectedRPID: getRequestRPID(req),
      authenticator: {
        credentialID: dbCredential.credentialID,
        credentialPublicKey: dbCredential.publicKey,
        counter: dbCredential.counter
      }
    });

    if (!verification.verified) {
      return res.status(400).json({ error: 'Passkey authentication failed.' });
    }

    // Update credential counter and last used time
    dbCredential.counter = verification.authenticationInfo.newCounter;
    dbCredential.lastUsedAt = new Date();
    await dbCredential.save();

    cache.del(`webauthn:auth:${userId}`);

    // Create an authenticated transaction token valid for 30 seconds
    const authTxToken = jwt.sign(
      { userId, type: 'webauthn_assertion', userVerified: true },
      config.JWT_SECRET,
      { expiresIn: '30s' }
    );

    return res.json({
      verified: true,
      authTxToken,
      message: 'Passkey verification successful!'
    });
  } catch (err) {
    console.error('WebAuthn auth verify error:', err);
    return res.status(500).json({ error: err.message || 'Passkey authentication failed' });
  }
}

module.exports = {
  register,
  login,
  me,
  logout,
  generateWebAuthnRegisterOpts,
  verifyWebAuthnRegistration,
  generateWebAuthnAuthOpts,
  verifyWebAuthnAuthentication
};
