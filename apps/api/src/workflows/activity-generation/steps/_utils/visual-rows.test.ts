import { describe, expect, test } from "vitest";
import { buildVisualRows } from "./visual-rows";

describe(buildVisualRows, () => {
  test("allows activities with no visuals", () => {
    const result = buildVisualRows({
      activityId: 1,
      dbSteps: [{ position: 0 }, { position: 2 }],
      visuals: [],
    });

    expect(result).toEqual([]);
  });

  test("fails when visuals do not cover every step", () => {
    const result = buildVisualRows({
      activityId: 1,
      dbSteps: [{ position: 0 }, { position: 2 }],
      visuals: [{ kind: "image", prompt: "Only one visual", stepIndex: 0 }],
    });

    expect(result).toBeNull();
  });
});
