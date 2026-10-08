import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { findCurrentPhase } from "../../plans/_utils/plan-phase-views";
import { type MapItem, type MapNode, buildGoalMapAreas } from "./goal-map-areas";

const CHAPTERS = [randomUUID(), randomUUID()];

function node({ areaId, phase }: { areaId: string; phase: number }): MapNode {
  const skillId = randomUUID();

  return {
    areaId,
    phase,
    skill: {
      description: null,
      fading: false,
      name: skillId,
      prerequisiteIds: [],
      retrievability: null,
      skillId,
      state: "new",
    },
    title: areaId,
  };
}

/** A lesson of the phase's chapter, or a stand-in still waiting for its lessons. */
function lesson({
  phase,
  status = "todo",
  written = true,
}: {
  phase: number;
  status?: MapItem["status"];
  written?: boolean;
}): MapItem {
  return {
    chapterId: written ? (CHAPTERS[phase] ?? null) : null,
    id: randomUUID(),
    kind: "lesson",
    lessonId: written ? randomUUID() : null,
    phase,
    skillIds: [],
    status,
  };
}

function build(items: MapItem[]) {
  return buildGoalMapAreas({
    areaDetails: new Map(),
    items,
    nodes: [node({ areaId: "phase:0", phase: 0 }), node({ areaId: "phase:1", phase: 1 })],
    phaseNames: ["Basics", "Practice"],
  });
}

describe(buildGoalMapAreas, () => {
  it("is in the plan's current phase, past a stand-in still waiting for its lessons", () => {
    const items = [lesson({ phase: 0, written: false }), lesson({ phase: 1 })];
    const map = build(items);

    expect(findCurrentPhase({ items, phaseCount: 2 })).toBe(1);
    expect(map.phases.map((phase) => phase.state)).toStrictEqual(["done", "current"]);
    expect(map.areas.filter((area) => area.current).map((area) => area.phase)).toStrictEqual([1]);
  });

  it("keeps the last phase current once everything is done, as Plan does", () => {
    const map = build([lesson({ phase: 0, status: "done" }), lesson({ phase: 1, status: "done" })]);

    expect(map.phases.map((phase) => phase.state)).toStrictEqual(["done", "current"]);
    expect(map.areas.some((area) => area.current)).toBe(false);
  });
});
