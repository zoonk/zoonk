import { describe, expect, it } from "vitest";
import { type PlanGraph } from "../planner/plan-state";
import { pickSetAsidePlans } from "./set-aside-plans";

const graph: PlanGraph = {
  phases: [{ milestone: null, name: "Basics" }],
  skills: ["cells", "nucleus", "logic", "sets", "proofs"].map((skillId) => ({
    area: "Area",
    lessons: 3,
    name: skillId,
    phase: 0,
    skillId,
    topics: [skillId],
    weight: null,
  })),
};

function planned(skillIds: string[]) {
  return {
    computed: {
      built: { items: skillIds.map((skillId) => ({ skillId, status: "todo" as const })) },
      state: { graph },
    },
  };
}

describe("set-aside work on a change made only of base choices", () => {
  it("stays out when bringing it back costs a topic the plan holds", () => {
    const shown = [
      { skillId: "nucleus", status: "todo" as const },
      { skillId: "cells", status: "skipped" as const },
    ];

    const picked = pickSetAsidePlans({
      brought: planned(["cells"]),
      kept: planned(["nucleus"]),
      shown,
    });

    expect(picked).toMatchObject({ bringsBackSetAside: false, ...planned(["nucleus"]) });
  });

  it("comes back when leaving it out costs topics too", () => {
    const shown = [
      { skillId: "logic", status: "skipped" as const },
      { skillId: "sets", status: "todo" as const },
      { skillId: "proofs", status: "todo" as const },
    ];

    const picked = pickSetAsidePlans({
      brought: planned(["logic", "sets"]),
      kept: planned([]),
      shown,
    });

    expect(picked).toMatchObject({ bringsBackSetAside: true, ...planned(["logic", "sets"]) });
  });
});
