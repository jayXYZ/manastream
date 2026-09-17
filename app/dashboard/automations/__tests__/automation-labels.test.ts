import { describe, expect, it } from "vitest";

import {
  buildObsCommand,
  describeAction,
  describeCommand,
  formatRelativeTime,
  COMMAND_KINDS,
  TRIGGER_FIELDS,
  TRIGGER_LABELS,
} from "../automation-labels";
import { AUTOMATION_TRIGGERS } from "../../../../convex/validators";

describe("automation labels", () => {
  it("has a label and field list for every trigger", () => {
    for (const trigger of AUTOMATION_TRIGGERS) {
      expect(TRIGGER_LABELS[trigger]).toBeTruthy();
      expect(TRIGGER_FIELDS[trigger].length).toBeGreaterThan(0);
    }
  });

  it("describes actions for humans", () => {
    const names = new Map([["ctrl1", "Main PC"]]);
    expect(
      describeAction(
        { type: "webhook", url: "https://hooks.example.com/abc", method: "POST" },
        names,
      ),
    ).toBe("POST webhook to hooks.example.com");
    expect(
      describeAction(
        {
          type: "obs",
          controllerId: "ctrl1" as never,
          command: { kind: "streaming.stop" },
        },
        names,
      ),
    ).toBe("Stop streaming on Main PC");
    expect(
      describeAction(
        {
          type: "obs",
          controllerId: "missing" as never,
          command: { kind: "scene.set", sceneName: "Match" },
        },
        names,
      ),
    ).toBe('Switch scene to "Match" on deleted controller');
    expect(
      describeCommand({
        kind: "sceneItem.setEnabled",
        sceneName: "Match",
        sourceName: "Cam",
        enabled: false,
      }),
    ).toBe('Hide "Cam" in "Match"');
  });
});

describe("buildObsCommand", () => {
  const base = {
    sceneName: "",
    sourceName: "",
    filterName: "",
    enabled: true,
    requestType: "",
    requestData: "",
  };

  it("builds simple commands without extra fields", () => {
    for (const kind of COMMAND_KINDS) {
      if (
        kind === "scene.set" ||
        kind === "sceneItem.setEnabled" ||
        kind === "filter.setEnabled" ||
        kind === "raw"
      ) {
        continue;
      }
      expect(buildObsCommand({ ...base, kind })).toEqual({ kind });
    }
  });

  it("validates required fields and JSON", () => {
    expect(buildObsCommand({ ...base, kind: "scene.set" })).toEqual({
      error: "Scene name is required",
    });
    expect(
      buildObsCommand({ ...base, kind: "scene.set", sceneName: " Match " }),
    ).toEqual({ kind: "scene.set", sceneName: "Match" });
    expect(
      buildObsCommand({
        ...base,
        kind: "raw",
        requestType: "GetVersion",
        requestData: "{bad",
      }),
    ).toEqual({ error: "Request data must be valid JSON" });
    expect(
      buildObsCommand({
        ...base,
        kind: "raw",
        requestType: "SetCurrentProgramScene",
        requestData: '{"sceneName":"X"}',
      }),
    ).toEqual({
      kind: "raw",
      requestType: "SetCurrentProgramScene",
      requestData: { sceneName: "X" },
    });
  });
});

describe("formatRelativeTime", () => {
  it("picks a sensible unit", () => {
    const now = 10_000_000;
    expect(formatRelativeTime(now - 5_000, now)).toBe("5s ago");
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5m ago");
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(formatRelativeTime(now - 5 * 86_400_000, now)).toBe("5d ago");
  });
});
