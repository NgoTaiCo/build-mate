/**
 * Deterministic unit tests for the pure device-auth module (Quality Gate).
 * No live gateway. A fixed known seed must always produce the same identity.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verify as cryptoVerify, createPublicKey } from 'node:crypto';
import {
  seedToKeyPair,
  publicKeyRawBase64url,
  buildV3Payload,
  sign,
} from '../src/device-auth.js';

// A fixed, arbitrary 32-byte seed (all-zero-ish but non-trivial) as base64url.
const FIXED_SEED = Buffer.from(
  '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f',
  'hex',
).toString('base64url');

test('deviceId is deterministic across calls for a fixed seed', () => {
  const a = seedToKeyPair(FIXED_SEED);
  const b = seedToKeyPair(FIXED_SEED);
  assert.equal(a.deviceId, b.deviceId);
  // hex(SHA-256(...)) is 64 hex chars.
  assert.match(a.deviceId, /^[0-9a-f]{64}$/);
});

test('raw public key is 32 bytes and base64url-encoded', () => {
  const kp = seedToKeyPair(FIXED_SEED);
  assert.equal(kp.publicKeyRaw.length, 32);
  const b64 = publicKeyRawBase64url(kp);
  // base64url of 32 bytes is 43 chars, no padding, no +/ characters.
  assert.equal(b64.length, 43);
  assert.doesNotMatch(b64, /[+/=]/);
});

test('rejects a seed that is not 32 bytes', () => {
  const shortSeed = Buffer.from('deadbeef', 'hex').toString('base64url');
  assert.throws(() => seedToKeyPair(shortSeed), /32 bytes/);
});

test('buildV3Payload produces the exact pipe-delimited string', () => {
  const payload = buildV3Payload({
    deviceId: 'DEV',
    clientId: 'webchat-ui',
    clientMode: 'webchat',
    role: 'operator',
    scopes: ['operator.read', 'operator.write'],
    signedAtMs: 1783763371228,
    token: 'TOK',
    nonce: 'NONCE',
    platform: 'WEB',
    deviceFamily: 'WEB',
  });
  assert.equal(
    payload,
    'v3|DEV|webchat-ui|webchat|operator|operator.read,operator.write|1783763371228|TOK|NONCE|web|web',
  );
});

test('signature is a 64-byte Ed25519 signature that verifies', () => {
  const kp = seedToKeyPair(FIXED_SEED);
  const payload = buildV3Payload({
    deviceId: kp.deviceId,
    clientId: 'webchat-ui',
    clientMode: 'webchat',
    role: 'operator',
    scopes: ['operator.read', 'operator.write'],
    signedAtMs: 1783763371228,
    token: 'TOK',
    nonce: 'NONCE',
    platform: 'web',
    deviceFamily: 'web',
  });
  const sigB64 = sign(kp, payload);
  const sigBytes = Buffer.from(sigB64, 'base64url');
  assert.equal(sigBytes.length, 64);

  // Verify against a public key reconstructed from the raw bytes (JWK).
  const pubKey = createPublicKey({
    key: {
      kty: 'OKP',
      crv: 'Ed25519',
      x: kp.publicKeyRaw.toString('base64url'),
    },
    format: 'jwk',
  });
  const ok = cryptoVerify(null, Buffer.from(payload, 'utf8'), pubKey, sigBytes);
  assert.equal(ok, true);
});

test('signature is deterministic for the same seed + payload', () => {
  const kp = seedToKeyPair(FIXED_SEED);
  const payload = 'v3|x|y';
  assert.equal(sign(kp, payload), sign(kp, payload));
});
