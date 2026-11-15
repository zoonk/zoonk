import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { type Capture, mergeCapture } from "./layout-capture.mts";

function capture(overrides: Partial<Capture>): Capture {
  return {
    build: { commit: "abc" },
    configuration: { height: 912, size: "phone", width: 420 },
    picture: { file: "plan.after.png", sha256: "1" },
    scale: 3,
    scenario: "plan",
    screen: "/plan",
    side: "after",
    ...overrides,
  };
}

describe(mergeCapture, () => {
  it("keeps a before and an after of one scenario", () => {
    const before = capture({ picture: { file: "plan.before.png", sha256: "1" }, side: "before" });
    const after = capture({ picture: { file: "plan.after.png", sha256: "2" }, side: "after" });

    assert.deepEqual(mergeCapture([before], after), [before, after]);
  });

  it("replaces a retake of the same shot", () => {
    const first = capture({ build: { commit: "abc" } });

    const retake = capture({
      build: { commit: "def" },
      picture: { file: "plan.after.png", sha256: "2" },
    });

    assert.deepEqual(mergeCapture([first], retake), [retake]);
  });

  it("refuses another screen under the same scenario and side", () => {
    const plan = capture({ screen: "/plan" });
    const today = capture({ screen: "/today" });

    assert.throws(() => mergeCapture([plan], today), /another screen or configuration/u);
  });

  it("refuses another configuration under the same scenario and side", () => {
    const phone = capture({});
    const tablet = capture({ configuration: { height: 1366, size: "tablet", width: 1024 } });

    assert.throws(() => mergeCapture([phone], tablet), /another screen or configuration/u);
  });
});
