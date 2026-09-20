/**
 * Maps ManaStream OBS commands onto obs-websocket v5 requests.
 *
 * This module has no runtime dependency on obs-websocket-js so it can be unit
 * tested with a fake client. The command shape mirrors `obsCommandValidator`
 * in the ManaStream Convex backend; keep the two in sync when adding kinds.
 */

export type ObsCommand =
  | { kind: "streaming.start" }
  | { kind: "streaming.stop" }
  | { kind: "recording.start" }
  | { kind: "recording.stop" }
  | { kind: "replayBuffer.save" }
  | { kind: "scene.set"; sceneName: string }
  | {
      kind: "sceneItem.setEnabled";
      sceneName: string;
      sourceName: string;
      enabled: boolean;
    }
  | {
      kind: "filter.setEnabled";
      sourceName: string;
      filterName: string;
      enabled: boolean;
    }
  | { kind: "raw"; requestType: string; requestData?: unknown };

/** The subset of obs-websocket-js the executor needs. */
export interface ObsClient {
  call(requestType: string, requestData?: unknown): Promise<unknown>;
}

export type CommandResult = {
  requestType: string;
  /** True when OBS was already in the requested state and no call was made. */
  alreadySatisfied?: boolean;
  response?: unknown;
};

type OutputStatus = { outputActive?: boolean };

async function outputActive(
  obs: ObsClient,
  statusRequest: string,
): Promise<boolean> {
  const status = (await obs.call(statusRequest)) as OutputStatus | undefined;
  return status?.outputActive === true;
}

/**
 * Runs one command against OBS. Start and stop commands are idempotent: if
 * OBS already matches the requested state the call is skipped and reported
 * as satisfied, so a repeated "start streaming" never surfaces as an error.
 */
export async function executeCommand(
  obs: ObsClient,
  command: ObsCommand,
): Promise<CommandResult> {
  switch (command.kind) {
    case "streaming.start":
      return toggleOutput(obs, "GetStreamStatus", "StartStream", true);
    case "streaming.stop":
      return toggleOutput(obs, "GetStreamStatus", "StopStream", false);
    case "recording.start":
      return toggleOutput(obs, "GetRecordStatus", "StartRecord", true);
    case "recording.stop":
      return toggleOutput(obs, "GetRecordStatus", "StopRecord", false);
    case "replayBuffer.save":
      return simpleCall(obs, "SaveReplayBuffer");
    case "scene.set":
      return simpleCall(obs, "SetCurrentProgramScene", {
        sceneName: command.sceneName,
      });
    case "sceneItem.setEnabled": {
      const lookup = (await obs.call("GetSceneItemId", {
        sceneName: command.sceneName,
        sourceName: command.sourceName,
      })) as { sceneItemId?: number } | undefined;
      if (lookup?.sceneItemId === undefined) {
        throw new Error(
          `Source "${command.sourceName}" was not found in scene "${command.sceneName}"`,
        );
      }
      return simpleCall(obs, "SetSceneItemEnabled", {
        sceneName: command.sceneName,
        sceneItemId: lookup.sceneItemId,
        sceneItemEnabled: command.enabled,
      });
    }
    case "filter.setEnabled":
      return simpleCall(obs, "SetSourceFilterEnabled", {
        sourceName: command.sourceName,
        filterName: command.filterName,
        filterEnabled: command.enabled,
      });
    case "raw": {
      if (!command.requestType || typeof command.requestType !== "string") {
        throw new Error("Raw command is missing a requestType");
      }
      return simpleCall(obs, command.requestType, command.requestData);
    }
    default: {
      const unknown = command as { kind?: unknown };
      throw new Error(`Unsupported OBS command kind: ${String(unknown.kind)}`);
    }
  }
}

async function toggleOutput(
  obs: ObsClient,
  statusRequest: string,
  actionRequest: string,
  desiredActive: boolean,
): Promise<CommandResult> {
  const active = await outputActive(obs, statusRequest);
  if (active === desiredActive) {
    return { requestType: actionRequest, alreadySatisfied: true };
  }
  return simpleCall(obs, actionRequest);
}

async function simpleCall(
  obs: ObsClient,
  requestType: string,
  requestData?: unknown,
): Promise<CommandResult> {
  const response = await obs.call(requestType, requestData);
  return { requestType, response };
}

/** Human-readable label used in bridge logs. */
export function describeCommand(command: ObsCommand): string {
  switch (command.kind) {
    case "scene.set":
      return `scene.set(${command.sceneName})`;
    case "sceneItem.setEnabled":
      return `sceneItem.setEnabled(${command.sceneName}/${command.sourceName} -> ${command.enabled})`;
    case "filter.setEnabled":
      return `filter.setEnabled(${command.sourceName}/${command.filterName} -> ${command.enabled})`;
    case "raw":
      return `raw(${command.requestType})`;
    default:
      return command.kind;
  }
}
