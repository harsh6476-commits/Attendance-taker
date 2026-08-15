import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { api } from './api';

/**
 * Registers a new WebAuthn Passkey for the current logged-in user
 */
export async function registerPasskey(deviceLabel = 'Mobile Authenticator') {
  try {
    const options = await api.getWebAuthnRegOpts();
    const attResp = await startRegistration({ optionsJSON: options });
    const result = await api.verifyWebAuthnReg({ response: attResp, deviceLabel });
    return result;
  } catch (err) {
    console.error('Passkey registration error:', err);
    throw new Error(err.message || 'Failed to register passkey');
  }
}

/**
 * Authenticates user via WebAuthn Passkey and returns an authTxToken (valid for 30s)
 */
export async function authenticatePasskey() {
  try {
    const options = await api.getWebAuthnAuthOpts();
    const asseResp = await startAuthentication({ optionsJSON: options });
    const result = await api.verifyWebAuthnAuth({ response: asseResp });
    return result; // { verified: true, authTxToken: '...' }
  } catch (err) {
    console.error('Passkey authentication error:', err);
    throw new Error(err.message || 'Passkey authentication failed');
  }
}
