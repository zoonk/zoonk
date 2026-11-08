import { describe, expect, it } from "vitest";
import { toPlanLevel } from "./plan-level";

const B1 = { label: "B1", score: 2 };
const B1_PLUS = { label: "B1+", score: 2.5 };

describe(toPlanLevel, () => {
  it("shows the goal beside a level below it", () => {
    expect(toPlanLevel({ label: "A1", target: B1_PLUS })).toStrictEqual({
      label: "A1",
      target: "B1+",
    });

    expect(toPlanLevel({ label: "B1", target: B1_PLUS })).toStrictEqual({
      label: "B1",
      target: "B1+",
    });
  });

  it("shows only the level once it reaches or passes the goal", () => {
    expect(toPlanLevel({ label: "B1+", target: B1_PLUS })).toStrictEqual({
      label: "B1+",
      target: null,
    });

    expect(toPlanLevel({ label: "B1+", target: B1 })).toStrictEqual({ label: "B1+", target: null });

    expect(toPlanLevel({ label: "B2", target: B1_PLUS })).toStrictEqual({
      label: "B2",
      target: null,
    });
  });

  it("shows only the level when the learner gave no goal", () => {
    expect(toPlanLevel({ label: "A2", target: null })).toStrictEqual({ label: "A2", target: null });
  });
});
