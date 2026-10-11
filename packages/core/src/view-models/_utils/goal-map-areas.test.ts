import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { findCurrentPhase } from "../../plans/_utils/plan-phase-views";
import { type TodayLearnBlock } from "../../plans/_utils/up-next-item";
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

function build(items: MapItem[], todayBlocks: TodayLearnBlock[] = []) {
  return buildGoalMapAreas({
    areaDetails: new Map(),
    items,
    nodes: [node({ areaId: "phase:0", phase: 0 }), node({ areaId: "phase:1", phase: 1 })],
    phaseNames: ["Basics", "Practice"],
    todayBlocks,
  });
}

describe(buildGoalMapAreas, () => {
  // A phase isn't done while a stand-in in it still waits for its lessons, though the learner does
  // a later phase's written lessons meanwhile: those are up next, as on Today.
  it("is in the plan's current phase, the earliest with a lesson left", () => {
    const items = [lesson({ phase: 0, written: false }), lesson({ phase: 1 })];
    const map = build(items);

    expect(findCurrentPhase({ items, phaseCount: 2 })).toBe(0);
    expect(map.phases.map((phase) => phase.state)).toStrictEqual(["current", "upcoming"]);
    expect(map.areas.filter((area) => area.current).map((area) => area.phase)).toStrictEqual([1]);
  });

  // Pedro's Today opened a lesson of his second phase while the map put him in the first.
  it("puts the learner where the lesson Today opens next is, even in the next phase", () => {
    const ahead = lesson({ phase: 1 });
    const items = [lesson({ phase: 0 }), ahead];
    const map = build(items, [{ lessonId: ahead.lessonId, planItemId: ahead.id }]);

    expect(map.upNextItemId).toBe(ahead.id);
    expect(map.phases.map((phase) => phase.state)).toStrictEqual(["current", "upcoming"]);
    expect(map.areas.filter((area) => area.current).map((area) => area.phase)).toStrictEqual([1]);
  });

  // Missed days set the first phase's last lesson aside: the plan moves on, but neither the phase
  // nor its chapter reads as done.
  it("never reads a phase or chapter whose lessons were set aside as done", () => {
    const map = build([
      lesson({ phase: 0, status: "done" }),
      lesson({ phase: 0, status: "skipped" }),
      lesson({ phase: 1 }),
    ]);

    expect(map.phases.map((phase) => phase.state)).toStrictEqual(["unfinished", "current"]);
    expect(map.areas.find((area) => area.phase === 0)?.state).toBe("upcoming");
  });

  it("keeps the last phase current once everything is done, as Plan does", () => {
    const map = build([lesson({ phase: 0, status: "done" }), lesson({ phase: 1, status: "done" })]);

    expect(map.phases.map((phase) => phase.state)).toStrictEqual(["done", "current"]);
    expect(map.areas.some((area) => area.current)).toBe(false);
  });
});
