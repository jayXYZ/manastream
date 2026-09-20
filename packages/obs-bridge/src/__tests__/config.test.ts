import { describe, expect, it } from "vitest";

import {
  ConfigError,
  DEFAULT_HEARTBEAT_MS,
  DEFAULT_OBS_URL,
  loadConfig,
} from "../config.js";

describe("loadConfig", () => {
  it("prefers CLI flags over environment variables and applies defaults", () => {
    const config = loadConfig(
      ["--convex-url", "https://flag.convex.cloud", "--token", "flag-token"],
      {
        MANASTREAM_CONVEX_URL: "https://env.convex.cloud",
        MANASTREAM_BRIDGE_TOKEN: "env-token",
        OBS_WEBSOCKET_PASSWORD: "secret",
      },
    );
    expect(config).toEqual({
      convexUrl: "https://flag.convex.cloud",
      token: "flag-token",
      obsUrl: DEFAULT_OBS_URL,
      obsPassword: "secret",
      heartbeatMs: DEFAULT_HEARTBEAT_MS,
    });
  });

  it("reads everything from the environment when no flags are given", () => {
    const config = loadConfig([], {
      MANASTREAM_CONVEX_URL: "https://env.convex.cloud",
      MANASTREAM_BRIDGE_TOKEN: "env-token",
      OBS_WEBSOCKET_URL: "ws://10.0.0.5:4455",
      MANASTREAM_HEARTBEAT_MS: "10000",
    });
    expect(config.obsUrl).toBe("ws://10.0.0.5:4455");
    expect(config.heartbeatMs).toBe(10000);
    expect(config.obsPassword).toBeUndefined();
  });

  it("fails clearly when required values are missing or invalid", () => {
    expect(() => loadConfig([], {})).toThrow(ConfigError);
    expect(() => loadConfig([], {})).toThrow(/MANASTREAM_CONVEX_URL/);
    expect(() =>
      loadConfig([], { MANASTREAM_CONVEX_URL: "https://x.convex.cloud" }),
    ).toThrow(/MANASTREAM_BRIDGE_TOKEN/);
    expect(() =>
      loadConfig(["--heartbeat-ms", "10"], {
        MANASTREAM_CONVEX_URL: "https://x.convex.cloud",
        MANASTREAM_BRIDGE_TOKEN: "t",
      }),
    ).toThrow(/Heartbeat/);
    expect(() => loadConfig(["--help"], {})).toThrow(/Usage/);
  });
});
