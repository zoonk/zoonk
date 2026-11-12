import { describe, expect, it } from "vitest";
import { type PlanGraph } from "../planner/plan-state";
import { listPlanAreaNames } from "./plan-area-order";

const GRAPH: PlanGraph = {
  phases: [],
  skills: ["Mathematics", "Logic", "IT", "History", "Mathematics"].map((area, index) => ({
    area,
    lessons: 1,
    name: area,
    phase: 0,
    skillId: String(index),
    weight: null,
  })),
};

describe("plan subject order", () => {
  it("keeps the saved focus priority ahead of the other subjects", () => {
    expect(
      listPlanAreaNames({ focusAreas: ["Logic", "IT", "Mathematics"], graph: GRAPH }),
    ).toStrictEqual(["Logic", "IT", "Mathematics", "History"]);
  });

  it("keeps graph order when there is no focus", () => {
    expect(listPlanAreaNames({ focusAreas: [], graph: GRAPH })).toStrictEqual([
      "Mathematics",
      "Logic",
      "IT",
      "History",
    ]);
  });

  it("leaves subjects absent from the graph out of the view", () => {
    expect(listPlanAreaNames({ focusAreas: ["Missing", "IT"], graph: GRAPH })).toStrictEqual([
      "IT",
      "Mathematics",
      "Logic",
      "History",
    ]);
  });
});
