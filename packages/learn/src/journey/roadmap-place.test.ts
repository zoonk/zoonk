import { describe, expect, it } from "vitest";
import { getRoadmapPlace } from "./roadmap-place";

describe(getRoadmapPlace, () => {
  it("names the phase under way by its place among the phases", () => {
    const phases = [
      { state: "done" as const },
      { state: "current" as const },
      { state: "upcoming" as const },
    ];

    expect(getRoadmapPlace(phases)).toStrictEqual({ number: 2, phase: phases[1], total: 3 });
  });

  it("names no place in a plan of one phase, which is the whole plan", () => {
    expect(getRoadmapPlace([{ state: "current" as const }])).toBeNull();
  });

  it("names no place while no phase is under way", () => {
    expect(getRoadmapPlace([{ state: "done" as const }, { state: "done" as const }])).toBeNull();
  });
});
