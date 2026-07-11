/**
 * Fixed Ed25519 device identity — PURE module (no I/O, no globals).
 *
 * Ports the browser reference (`openclaw-client.html`) to Node: tweetnacl is
 * replaced by `node:crypto` Ed25519, and the `localStorage`-persisted keypair is
 * replaced by a fixed seed from config. The same seed always yields the same
 * `deviceId`, so the device is approved on the gateway exactly once
 * (FR-004, FR-005, SC-002).
 *
 * Unit-tested independently of a live gateway (Quality Gate, Principle V).
 */
import {
  createPrivateKey,
  createPublicKey,
  sign as cryptoSign,
  createHash,
  type KeyObject,
} from 'node:crypto';

/** PKCS8 DER header for an Ed25519 private key; the 32-byte seed follows. */
const PKCS8_ED25519_PREFIX = Buffer.from(
  '302e020100300506032b657004220420',
  'hex',
);

export interface DeviceKeyPair {
  /** In-memory private key. Never logged/returned (FR-012). */
  privateKey: KeyObject;
  /** Raw 32-byte Ed25519 public key. */
  publicKeyRaw: Buffer;
  /** hex(SHA-256(publicKeyRaw)) — stable across restarts. */
  deviceId: string;
}

export interface V3PayloadParams {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string;
  nonce: string;
  platform: string;
  deviceFamily: string;
}

/** Derive the fixed keypair + deviceId from a base64url 32-byte seed. */
export function seedToKeyPair(seedB64url: string): DeviceKeyPair {
  const seed = Buffer.from(seedB64url, 'base64url');
  if (seed.length !== 32) {
    throw new Error('device seed must decode to exactly 32 bytes');
  }
  const der = Buffer.concat([PKCS8_ED25519_PREFIX, seed]);
  const privateKey = createPrivateKey({
    key: der,
    format: 'der',
    type: 'pkcs8',
  });
  const publicKeyRaw = rawPublicKey(privateKey);
  const deviceId = createHash('sha256').update(publicKeyRaw).digest('hex');
  return { privateKey, publicKeyRaw, deviceId };
}

/** Extract the raw 32-byte public key from a private key via JWK `x`. */
function rawPublicKey(privateKey: KeyObject): Buffer {
  const jwk = createPublicKey(privateKey).export({ format: 'jwk' }) as {
    x?: string;
  };
  if (!jwk.x) throw new Error('failed to derive raw Ed25519 public key');
  return Buffer.from(jwk.x, 'base64url');
}

/** Base64url of the raw public key — sent as `device.publicKey`. */
export function publicKeyRawBase64url(keyPair: DeviceKeyPair): string {
  return keyPair.publicKeyRaw.toString('base64url');
}

/**
 * Build the exact pipe-delimited V3 signature payload the gateway expects
 * (see contracts/gateway-connect.md). `platform`/`deviceFamily` are lowercased.
 */
export function buildV3Payload(p: V3PayloadParams): string {
  const scopesStr = p.scopes.join(',');
  const platform = p.platform.toLowerCase();
  const deviceFamily = p.deviceFamily.toLowerCase();
  return `v3|${p.deviceId}|${p.clientId}|${p.clientMode}|${p.role}|${scopesStr}|${p.signedAtMs}|${p.token}|${p.nonce}|${platform}|${deviceFamily}`;
}

/** Sign the payload with the device private key; return base64url signature. */
export function sign(keyPair: DeviceKeyPair, payload: string): string {
  // Ed25519 uses no separate digest; pass `null` as the algorithm.
  const signature = cryptoSign(null, Buffer.from(payload, 'utf8'), keyPair.privateKey);
  return signature.toString('base64url');
}
