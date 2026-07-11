/**
 * Entry point: load config, derive the FIXED device identity from the config
 * seed, open the gateway connection, and start the HTTP server.
 *
 * The identity comes ONLY from `OPENCLAW_DEVICE_SEED` (FR-004, FR-005): there is
 * no random keygen and no filesystem/localStorage persistence anywhere, so the
 * same seed always yields the same `deviceId` and the device is approved once.
 */
import { loadConfig, ConfigError } from './config.js';
import { seedToKeyPair } from './device-auth.js';
import { GatewayClient } from './gateway-client.js';
import { createHttpServer } from './http-server.js';
import { DomBridge } from './dom-bridge.js';

function main(): void {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      // Message never contains the secret value itself (FR-012).
      console.error(`[config] ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  // Deterministic identity from the fixed seed — no random, no persistence.
  const keyPair = seedToKeyPair(config.deviceSeed);
  const gateway = new GatewayClient(config, keyPair);
  gateway.connect();

  // DOM executor bridge: relays semantic commands MCP <-> BuildPC extension.
  // Extension connects over WebSocket (/dom-bridge); MCP posts /dom-commands.
  const domBridge = new DomBridge();
  const server = createHttpServer(gateway, config.defaultAgentId, domBridge);
  domBridge.attach(server);
  server.listen(config.httpPort, () => {
    console.log(
      `[chat-backend] listening on :${config.httpPort} | deviceId=${keyPair.deviceId} | gateway=${config.gatewayUrl}`,
    );
    console.log(
      '[chat-backend] nếu là first boot: approve device qua `openclaw devices approve <requestId>`.',
    );
  });

  const shutdown = () => {
    gateway.close();
    domBridge.close();
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
