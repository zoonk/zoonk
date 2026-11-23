import { type WrittenProjection } from "@zoonk/core/exams/scoring/written-points-contract";
import { describe, expect, it } from "vitest";
import { getProjectionWriteTask } from "./projection-write-task";

type Part = WrittenProjection["parts"][number];

function projection(part: Partial<Part>): WrittenProjection {
  return {
    combined: null,
    max: 200,
    objective: { high: 70, low: 60 },
    objectiveMax: 100,
    parts: [
      {
        max: 100,
        minimum: { unit: "points", value: 50 },
        name: "Written test",
        range: null,
        scale: "points",
        standing: "unmeasured",
        tasks: [
          { key: "short", max: 30, name: "The 30-line question", range: { high: 22, low: 18 } },
          { key: "long", max: 70, name: "The 60-line question", range: null },
        ],
        ...part,
      },
    ],
  };
}

describe(getProjectionWriteTask, () => {
  it("opens the question not measured yet when only the other one is", () => {
    expect(getProjectionWriteTask(projection({}))).toStrictEqual({ taskKey: "long" });
  });

  it("opens any question when a part measured in full is below its minimum", () => {
    const below = projection({
      range: { high: 45, low: 40 },
      standing: "below",
      tasks: [
        { key: "short", max: 30, name: "The 30-line question", range: { high: 12, low: 10 } },
        { key: "long", max: 70, name: "The 60-line question", range: { high: 33, low: 30 } },
      ],
    });

    expect(getProjectionWriteTask(below)).toStrictEqual({ taskKey: undefined });
  });

  it("offers nothing to write once every part is measured and above its minimum", () => {
    const met = projection({
      range: { high: 80, low: 70 },
      standing: "met",
      tasks: [
        { key: "short", max: 30, name: "The 30-line question", range: { high: 25, low: 22 } },
        { key: "long", max: 70, name: "The 60-line question", range: { high: 55, low: 48 } },
      ],
    });

    expect(getProjectionWriteTask(met)).toBeNull();
  });
});
