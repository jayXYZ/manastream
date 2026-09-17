#!/usr/bin/env node
import { Bridge, createConsoleLogger } from "./bridge.js";
import { ConfigError, loadConfig } from "./config.js";

async function main(): Promise<void> {
  const log = createConsoleLogger();

  let config;
  try {
    config = loadConfig(process.argv.slice(2), process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(2);
    }
    throw error;
  }

  const bridge = new Bridge(config, log);

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`Received ${signal}, shutting down`);
    bridge
      .stop()
      .catch((error) => log.error(`Shutdown error: ${String(error)}`))
      .finally(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await bridge.start();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
