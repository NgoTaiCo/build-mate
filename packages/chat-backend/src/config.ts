/**
 * Load and validate backend configuration from environment.
 *
 * The backend is stateless (Constitution Principle I): config is read once at
 * boot and never persisted. Secrets (`gatewayToken`, `deviceSeed`) live only in
 * memory and MUST NOT appear in logs or error messages (FR-012).
 */

export interface BackendConfig {
  gatewayUrl: string;
  /** Shared gateway token. Secret — never log. */
  gatewayToken: string;
  /** Fixed Ed25519 seed, base64url (32 bytes). Secret — never log. */
  deviceSeed: string;
  httpPort: number;
  replyTimeoutMs: number;
  defaultAgentId: string;
}

/** Thrown when a required secret/config value is missing or malformed. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (value === undefined || value.trim() === '') {
    // Never echo the value (it may be a secret) — only the variable name.
    throw new ConfigError(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function numberEnv(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ConfigError(
      `Environment variable ${name} must be a positive number, got "${raw}"`,
    );
  }
  return parsed;
}

/**
 * Build the validated config from `env` (defaults to `process.env`).
 * Passing `env` explicitly keeps this pure/testable.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): BackendConfig {
  const deviceSeed = requireEnv(env, 'OPENCLAW_DEVICE_SEED');
  // Validate seed shape without ever logging its bytes.
  const seedBytes = Buffer.from(deviceSeed, 'base64url');
  if (seedBytes.length !== 32) {
    throw new ConfigError(
      'OPENCLAW_DEVICE_SEED must be a base64url-encoded 32-byte seed',
    );
  }

  return {
    gatewayUrl: env.OPENCLAW_GATEWAY_URL?.trim() || 'ws://localhost:18790',
    gatewayToken: requireEnv(env, 'OPENCLAW_GATEWAY_TOKEN'),
    deviceSeed,
    httpPort: numberEnv(env, 'PORT', 8790),
    replyTimeoutMs: numberEnv(env, 'REPLY_TIMEOUT_MS', 60000),
    defaultAgentId: env.DEFAULT_AGENT_ID?.trim() || 'main',
  };
}
