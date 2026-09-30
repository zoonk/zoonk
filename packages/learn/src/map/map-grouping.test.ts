import { type MapArea } from "@zoonk/core/view-models/map/contract";
import { describe, expect, it } from "vitest";
import { groupMapByCourse, groupMapByPhase } from "./map-grouping";

const counts = { fading: 0, learning: 1, mastered: 1, new: 0, solid: 0, total: 2 };

function area(areaId: string, overrides: Partial<MapArea> = {}): MapArea {
  return {
    areaId,
    chapterId: null,
    counts,
    courseId: null,
    current: false,
    phase: 0,
    skills: [],
    state: "upcoming",
    title: areaId,
    ...overrides,
  };
}

const areas = [
  area("fractions", { courseId: "math", state: "done" }),
  area("vectors", { courseId: "math", current: true, state: "current" }),
  area("waves", { courseId: "physics", phase: 2 }),
  area("phase:3", { phase: 3 }),
];

describe(groupMapByPhase, () => {
  it("groups chapters by phase with their counts, leaving out phases without chapters", () => {
    const phases = [0, 1, 2, 3].map((index) => ({
      counts,
      index,
      name: index === 1 ? "" : `Phase ${index}`,
      state: index === 0 ? ("current" as const) : ("upcoming" as const),
    }));

    const groups = groupMapByPhase({
      map: { areas, phases },
      phaseTitle: (phase) => phase.name || "Unnamed",
    });

    expect(
      groups.map((group) => [group.key, group.title, group.areas.length, group.counts.total]),
    ).toStrictEqual([
      ["phase:0", "Phase 0", 2, 4],
      ["phase:2", "Phase 2", 1, 2],
      ["phase:3", "Phase 3", 1, 2],
    ]);
  });
});

describe(groupMapByCourse, () => {
  it("groups chapters by course in plan order, with chapters not in a course last", () => {
    const groups = groupMapByCourse({
      map: {
        areas,
        courses: [
          { courseId: "math", title: "Math" },
          { courseId: "physics", title: "Physics" },
        ],
      },
      pendingTitle: "Coming up",
    });

    expect(groups.map((group) => [group.title, group.state, group.areas.length])).toStrictEqual([
      ["Math", "current", 2],
      ["Physics", "upcoming", 1],
      ["Coming up", "upcoming", 1],
    ]);
  });
});
