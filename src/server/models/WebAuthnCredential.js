const mongoose = require('mongoose');

const WebAuthnCredentialSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    credentialID: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    publicKey: {
      type: Buffer,
      required: true
    },
    counter: {
      type: Number,
      default: 0
    },
    deviceLabel: {
      type: String,
      default: 'Authenticator Device'
    },
    transports: [
      {
        type: String
      }
    ],
    lastUsedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('WebAuthnCredential', WebAuthnCredentialSchema);
