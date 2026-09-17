import { ConvexClient } from "convex/browser";
import OBSWebSocket, { EventSubscription } from "obs-websocket-js";

import type { BridgeConfig } from "./config.js";
import { describeCommand, executeCommand, type ObsClient } from "./commands.js";
import {
  bridgeHeartbeatRef,
  claimCommandRef,
  completeCommandRef,
  failCommandRef,
  pendingCommandsRef,
  reportObsEventRef,
  type ObsState,
  type PendingCommand,
} from "./convexApi.js";

export const BRIDGE_VERSION = "0.1.0";

const OBS_RECONNECT_MIN_MS = 2 * 1000;
const OBS_RECONNECT_MAX_MS = 30 * 1000;

export type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

export function createConsoleLogger(): Logger {
  const stamp = () => new Date().toISOString();
  return {
    info: (message) => console.log(`${stamp()} [info]  ${message}`),
    warn: (message) => console.warn(`${stamp()} [warn]  ${message}`),
    error: (message) => console.error(`${stamp()} [error] ${message}`),
  };
}

/**
 * Holds the two connections (ManaStream via Convex, OBS via obs-websocket),
 * drains the command queue, sends heartbeats, and forwards OBS events.
 */
export class Bridge {
  private readonly convex: ConvexClient;
  private readonly obs = new OBSWebSocket();
  private readonly obsClient: ObsClient;
  private obsConnected = false;
  private stopped = false;
  private reconnectDelayMs = OBS_RECONNECT_MIN_MS;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private heartbeatTimer: NodeJS.Timeout | undefined;
  private unsubscribe: (() => void) | undefined;
  private latestCommands: PendingCommand[] = [];
  private readonly inFlight = new Set<string>();
  private warnedNoObs = false;
  private lastSceneName: string | undefined;

  constructor(
    private readonly config: BridgeConfig,
    private readonly log: Logger = createConsoleLogger(),
  ) {
    this.convex = new ConvexClient(config.convexUrl);
    this.obsClient = {
      call: (requestType, requestData) =>
        this.obs.call(requestType as never, requestData as never),
    };
    this.registerObsEvents();
  }

  async start(): Promise<void> {
    this.log.info(`ManaStream OBS bridge ${BRIDGE_VERSION} starting`);
    this.log.info(`ManaStream: ${this.config.convexUrl}`);
    this.log.info(`OBS: ${this.config.obsUrl}`);

    this.unsubscribe = this.convex.onUpdate(
      pendingCommandsRef,
      { token: this.config.token },
      (commands) => {
        this.latestCommands = commands;
        void this.drain();
      },
      (error) => {
        this.log.error(`ManaStream subscription error: ${error.message}`);
      },
    );

    await this.connectObs();

    this.heartbeatTimer = setInterval(() => {
      void this.sendHeartbeat();
    }, this.config.heartbeatMs);
    await this.sendHeartbeat();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.unsubscribe?.();
    try {
      await this.sendHeartbeat({ connected: false });
    } catch {
      // Best effort on shutdown.
    }
    try {
      await this.obs.disconnect();
    } catch {
      // OBS may already be gone.
    }
    await this.convex.close();
    this.log.info("Bridge stopped");
  }

  // ---------------------------------------------------------------------
  // OBS connection
  // ---------------------------------------------------------------------

  private registerObsEvents(): void {
    this.obs.on("ConnectionClosed", (error) => {
      if (this.obsConnected) {
        this.log.warn(
          `OBS connection closed${error?.message ? `: ${error.message}` : ""}`,
        );
      }
      this.obsConnected = false;
      void this.sendHeartbeat({ connected: false });
      this.scheduleObsReconnect();
    });

    this.obs.on("StreamStateChanged", ({ outputState, outputActive }) => {
      if (outputState === "OBS_WEBSOCKET_OUTPUT_STARTED") {
        void this.reportObsEvent("obs.streaming.started", { streaming: true });
      } else if (outputState === "OBS_WEBSOCKET_OUTPUT_STOPPED") {
        void this.reportObsEvent("obs.streaming.stopped", {
          streaming: false,
        });
      } else {
        return;
      }
      this.log.info(`OBS stream ${outputActive ? "started" : "stopped"}`);
    });

    this.obs.on("CurrentProgramSceneChanged", ({ sceneName }) => {
      const previousSceneName = this.lastSceneName;
      this.lastSceneName = sceneName;
      void this.reportObsEvent("obs.scene.changed", {
        sceneName,
        previousSceneName,
      });
    });
  }

  private async connectObs(): Promise<void> {
    if (this.stopped || this.obsConnected) return;
    try {
      const { obsWebSocketVersion, negotiatedRpcVersion } =
        await this.obs.connect(this.config.obsUrl, this.config.obsPassword, {
          eventSubscriptions: EventSubscription.General | EventSubscription.Scenes | EventSubscription.Outputs,
          rpcVersion: 1,
        });
      this.obsConnected = true;
      this.warnedNoObs = false;
      this.reconnectDelayMs = OBS_RECONNECT_MIN_MS;
      this.log.info(
        `Connected to OBS (obs-websocket ${obsWebSocketVersion}, rpc ${negotiatedRpcVersion})`,
      );
      await this.sendHeartbeat();
      await this.drain();
    } catch (error) {
      this.log.warn(
        `Could not connect to OBS at ${this.config.obsUrl}: ${errorMessage(error)}`,
      );
      this.scheduleObsReconnect();
    }
  }

  private scheduleObsReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    const delay = this.reconnectDelayMs;
    this.reconnectDelayMs = Math.min(
      this.reconnectDelayMs * 2,
      OBS_RECONNECT_MAX_MS,
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.connectObs();
    }, delay);
  }

  // ---------------------------------------------------------------------
  // Command queue
  // ---------------------------------------------------------------------

  private async drain(): Promise<void> {
    if (this.stopped) return;
    const now = Date.now();
    const runnable = this.latestCommands.filter(
      (command) => !this.inFlight.has(command._id) && command.expiresAt > now,
    );
    if (runnable.length === 0) return;

    if (!this.obsConnected) {
      if (!this.warnedNoObs) {
        this.log.warn(
          `${runnable.length} command(s) waiting but OBS is not connected; they will expire if OBS stays offline`,
        );
        this.warnedNoObs = true;
      }
      return;
    }

    for (const command of runnable) {
      this.inFlight.add(command._id);
      void this.runCommand(command).finally(() => {
        this.inFlight.delete(command._id);
      });
    }
  }

  private async runCommand(command: PendingCommand): Promise<void> {
    const label = describeCommand(command.command);
    const { token } = this.config;

    let claimed = false;
    try {
      claimed = await this.convex.mutation(claimCommandRef, {
        token,
        commandId: command._id,
      });
    } catch (error) {
      this.log.error(`Failed to claim ${label}: ${errorMessage(error)}`);
      return;
    }
    if (!claimed) {
      this.log.info(`Skipped ${label}: already claimed or expired`);
      return;
    }

    try {
      const result = await executeCommand(this.obsClient, command.command);
      this.log.info(
        `Ran ${label}${result.alreadySatisfied ? " (already in requested state)" : ""}`,
      );
      await this.convex.mutation(completeCommandRef, {
        token,
        commandId: command._id,
        result,
      });
    } catch (error) {
      const message = errorMessage(error);
      this.log.error(`Command ${label} failed: ${message}`);
      try {
        await this.convex.mutation(failCommandRef, {
          token,
          commandId: command._id,
          error: message,
        });
      } catch (reportError) {
        this.log.error(
          `Could not report failure for ${label}: ${errorMessage(reportError)}`,
        );
      }
    }
  }

  // ---------------------------------------------------------------------
  // Heartbeat and OBS -> ManaStream events
  // ---------------------------------------------------------------------

  private async readObsState(): Promise<ObsState> {
    if (!this.obsConnected) return { connected: false };
    try {
      const [stream, record, scene] = await Promise.all([
        this.obsClient.call("GetStreamStatus") as Promise<{
          outputActive?: boolean;
        }>,
        this.obsClient.call("GetRecordStatus") as Promise<{
          outputActive?: boolean;
        }>,
        this.obsClient.call("GetCurrentProgramScene") as Promise<{
          currentProgramSceneName?: string;
          sceneName?: string;
        }>,
      ]);
      const currentScene = scene.currentProgramSceneName ?? scene.sceneName;
      this.lastSceneName = currentScene ?? this.lastSceneName;
      return {
        connected: true,
        streaming: stream.outputActive === true,
        recording: record.outputActive === true,
        currentScene,
      };
    } catch (error) {
      this.log.warn(`Could not read OBS state: ${errorMessage(error)}`);
      return { connected: this.obsConnected };
    }
  }

  private async sendHeartbeat(override?: ObsState): Promise<void> {
    if (this.stopped && !override) return;
    const obsState = override ?? (await this.readObsState());
    try {
      await this.convex.mutation(bridgeHeartbeatRef, {
        token: this.config.token,
        bridgeVersion: BRIDGE_VERSION,
        obsState,
      });
    } catch (error) {
      this.log.warn(`Heartbeat failed: ${errorMessage(error)}`);
    }
  }

  private async reportObsEvent(
    type: "obs.streaming.started" | "obs.streaming.stopped" | "obs.scene.changed",
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (this.stopped) return;
    try {
      await this.convex.mutation(reportObsEventRef, {
        token: this.config.token,
        type,
        payload,
      });
    } catch (error) {
      this.log.warn(`Could not report ${type}: ${errorMessage(error)}`);
    }
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
