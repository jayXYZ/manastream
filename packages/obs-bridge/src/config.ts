import { parseArgs } from "node:util";

export type BridgeConfig = {
  /** ManaStream Convex deployment URL, e.g. https://xyz.convex.cloud */
  convexUrl: string;
  /** Controller token copied from the ManaStream dashboard. */
  token: string;
  /** obs-websocket URL, defaults to the local OBS instance. */
  obsUrl: string;
  obsPassword: string | undefined;
  /** Heartbeat interval in milliseconds. */
  heartbeatMs: number;
};

export const DEFAULT_OBS_URL = "ws://127.0.0.1:4455";
export const DEFAULT_HEARTBEAT_MS = 30 * 1000;

export class ConfigError extends Error {}

/**
 * Builds the bridge configuration from CLI flags first and environment
 * variables second. Flags: --convex-url, --token, --obs-url, --obs-password.
 */
export function loadConfig(
  argv: string[],
  env: NodeJS.ProcessEnv,
): BridgeConfig {
  const { values } = parseArgs({
    args: argv,
    options: {
      "convex-url": { type: "string" },
      token: { type: "string" },
      "obs-url": { type: "string" },
      "obs-password": { type: "string" },
      "heartbeat-ms": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });

  if (values.help) {
    throw new ConfigError(usage());
  }

  const convexUrl = values["convex-url"] ?? env.MANASTREAM_CONVEX_URL;
  const token = values.token ?? env.MANASTREAM_BRIDGE_TOKEN;
  const obsUrl = values["obs-url"] ?? env.OBS_WEBSOCKET_URL ?? DEFAULT_OBS_URL;
  const obsPassword = values["obs-password"] ?? env.OBS_WEBSOCKET_PASSWORD;
  const heartbeatRaw = values["heartbeat-ms"] ?? env.MANASTREAM_HEARTBEAT_MS;
  const heartbeatMs = heartbeatRaw ? Number(heartbeatRaw) : DEFAULT_HEARTBEAT_MS;

  if (!convexUrl) {
    throw new ConfigError(
      `Missing ManaStream URL. Pass --convex-url or set MANASTREAM_CONVEX_URL.\n\n${usage()}`,
    );
  }
  if (!token) {
    throw new ConfigError(
      `Missing controller token. Pass --token or set MANASTREAM_BRIDGE_TOKEN.\n\n${usage()}`,
    );
  }
  if (!Number.isFinite(heartbeatMs) || heartbeatMs < 5000) {
    throw new ConfigError("Heartbeat interval must be at least 5000 ms.");
  }

  return { convexUrl, token, obsUrl, obsPassword, heartbeatMs };
}

export function usage(): string {
  return [
    "Usage: manastream-obs-bridge [options]",
    "",
    "Options:",
    "  --convex-url <url>     ManaStream Convex URL (env MANASTREAM_CONVEX_URL)",
    "  --token <token>        Controller token from the dashboard (env MANASTREAM_BRIDGE_TOKEN)",
    `  --obs-url <url>        obs-websocket URL (env OBS_WEBSOCKET_URL, default ${DEFAULT_OBS_URL})`,
    "  --obs-password <pw>    obs-websocket password (env OBS_WEBSOCKET_PASSWORD)",
    `  --heartbeat-ms <ms>    Heartbeat interval (env MANASTREAM_HEARTBEAT_MS, default ${DEFAULT_HEARTBEAT_MS})`,
    "  -h, --help             Show this help",
  ].join("\n");
}
