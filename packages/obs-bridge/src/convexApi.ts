import { makeFunctionReference } from "convex/server";
import type { ObsCommand } from "./commands.js";

/**
 * References to the bridge-facing functions in `convex/automations.ts`.
 * They are declared by name so this package does not depend on the app's
 * generated API types.
 */

export type PendingCommand = {
  _id: string;
  command: ObsCommand;
  expiresAt: number;
  createdAt: number;
};

export type ObsState = {
  connected: boolean;
  streaming?: boolean;
  recording?: boolean;
  currentScene?: string;
};

export type ObsEventType =
  | "obs.streaming.started"
  | "obs.streaming.stopped"
  | "obs.scene.changed";

export const pendingCommandsRef = makeFunctionReference<
  "query",
  { token: string },
  PendingCommand[]
>("automations:pendingCommands");

export const claimCommandRef = makeFunctionReference<
  "mutation",
  { token: string; commandId: string },
  boolean
>("automations:claimCommand");

export const completeCommandRef = makeFunctionReference<
  "mutation",
  { token: string; commandId: string; result?: unknown },
  null
>("automations:completeCommand");

export const failCommandRef = makeFunctionReference<
  "mutation",
  { token: string; commandId: string; error: string },
  null
>("automations:failCommand");

export const bridgeHeartbeatRef = makeFunctionReference<
  "mutation",
  { token: string; bridgeVersion?: string; obsState: ObsState },
  null
>("automations:bridgeHeartbeat");

export const reportObsEventRef = makeFunctionReference<
  "mutation",
  { token: string; type: ObsEventType; payload?: unknown },
  null
>("automations:reportObsEvent");
