import { describe, expect, it } from "vitest";

import {
  describeCommand,
  executeCommand,
  type ObsClient,
  type ObsCommand,
} from "../commands.js";

function fakeObs(responses: Record<string, unknown> = {}) {
  const calls: { requestType: string; requestData?: unknown }[] = [];
  const client: ObsClient = {
    async call(requestType, requestData) {
      calls.push({ requestType, requestData });
      if (requestType in responses) {
        const value = responses[requestType];
        if (value instanceof Error) throw value;
        return value;
      }
      return {};
    },
  };
  return { client, calls };
}

describe("executeCommand", () => {
  it("starts streaming only when OBS is not already live", async () => {
    const idle = fakeObs({ GetStreamStatus: { outputActive: false } });
    const started = await executeCommand(idle.client, {
      kind: "streaming.start",
    });
    expect(started.alreadySatisfied).toBeUndefined();
    expect(idle.calls.map((call) => call.requestType)).toEqual([
      "GetStreamStatus",
      "StartStream",
    ]);

    const live = fakeObs({ GetStreamStatus: { outputActive: true } });
    const skipped = await executeCommand(live.client, {
      kind: "streaming.start",
    });
    expect(skipped.alreadySatisfied).toBe(true);
    expect(live.calls.map((call) => call.requestType)).toEqual([
      "GetStreamStatus",
    ]);
  });

  it("stops streaming and recording idempotently", async () => {
    const live = fakeObs({
      GetStreamStatus: { outputActive: true },
      GetRecordStatus: { outputActive: false },
    });
    await executeCommand(live.client, { kind: "streaming.stop" });
    const recordResult = await executeCommand(live.client, {
      kind: "recording.stop",
    });
    expect(recordResult.alreadySatisfied).toBe(true);
    expect(live.calls.map((call) => call.requestType)).toEqual([
      "GetStreamStatus",
      "StopStream",
      "GetRecordStatus",
    ]);
  });

  it("maps scene, filter, replay buffer, and raw commands", async () => {
    const obs = fakeObs();
    await executeCommand(obs.client, { kind: "scene.set", sceneName: "Match" });
    await executeCommand(obs.client, {
      kind: "filter.setEnabled",
      sourceName: "Cam",
      filterName: "Blur",
      enabled: false,
    });
    await executeCommand(obs.client, { kind: "replayBuffer.save" });
    await executeCommand(obs.client, {
      kind: "raw",
      requestType: "TriggerHotkeyByName",
      requestData: { hotkeyName: "OBSBasic.StartStreaming" },
    });

    expect(obs.calls).toEqual([
      { requestType: "SetCurrentProgramScene", requestData: { sceneName: "Match" } },
      {
        requestType: "SetSourceFilterEnabled",
        requestData: { sourceName: "Cam", filterName: "Blur", filterEnabled: false },
      },
      { requestType: "SaveReplayBuffer", requestData: undefined },
      {
        requestType: "TriggerHotkeyByName",
        requestData: { hotkeyName: "OBSBasic.StartStreaming" },
      },
    ]);
  });

  it("resolves scene item ids before toggling visibility", async () => {
    const obs = fakeObs({ GetSceneItemId: { sceneItemId: 7 } });
    await executeCommand(obs.client, {
      kind: "sceneItem.setEnabled",
      sceneName: "Match",
      sourceName: "Overlay",
      enabled: true,
    });
    expect(obs.calls[1]).toEqual({
      requestType: "SetSceneItemEnabled",
      requestData: { sceneName: "Match", sceneItemId: 7, sceneItemEnabled: true },
    });

    const missing = fakeObs({ GetSceneItemId: {} });
    await expect(
      executeCommand(missing.client, {
        kind: "sceneItem.setEnabled",
        sceneName: "Match",
        sourceName: "Nope",
        enabled: true,
      }),
    ).rejects.toThrow(/not found/);
  });

  it("propagates OBS errors and rejects unknown kinds", async () => {
    const failing = fakeObs({
      GetStreamStatus: { outputActive: false },
      StartStream: new Error("Output already active"),
    });
    await expect(
      executeCommand(failing.client, { kind: "streaming.start" }),
    ).rejects.toThrow("Output already active");

    await expect(
      executeCommand(fakeObs().client, { kind: "bogus" } as unknown as ObsCommand),
    ).rejects.toThrow(/Unsupported/);
    await expect(
      executeCommand(fakeObs().client, { kind: "raw", requestType: "" }),
    ).rejects.toThrow(/requestType/);
  });
});

describe("describeCommand", () => {
  it("produces readable labels", () => {
    expect(describeCommand({ kind: "streaming.stop" })).toBe("streaming.stop");
    expect(describeCommand({ kind: "scene.set", sceneName: "A" })).toBe(
      "scene.set(A)",
    );
    expect(
      describeCommand({ kind: "raw", requestType: "GetVersion" }),
    ).toBe("raw(GetVersion)");
  });
});
