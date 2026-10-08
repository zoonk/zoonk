import { describe, expect, it } from "vitest";
import { hasFocusGain } from "./focus-gain";

const DAY = 86_400_000;
const START = Date.parse("2026-10-05T00:00:00Z");

function lesson(skillId: string, day: number, minutes = 4) {
  return {
    kind: "lesson" as const,
    minutes,
    scheduledFor: new Date(START + day * DAY),
    skillId,
    status: "todo" as const,
  };
}

const areaOf = (skillId: string) => (skillId.startsWith("p") ? "Portfolio" : "Research");

describe(hasFocusGain, () => {
  it("is false when the area keeps its start and its lessons, however the days around it move", () => {
    const before = [lesson("r1", 0), lesson("p1", 10), lesson("r2", 11), lesson("p2", 14)];
    const after = [lesson("r1", 0), lesson("p1", 10), lesson("p2", 11), lesson("r2", 12)];

    expect(hasFocusGain({ after, areaOf, areas: ["Portfolio"], before })).toBe(false);
  });

  it("is true when the area starts earlier", () => {
    const before = [lesson("r1", 0), lesson("p1", 10)];
    const after = [lesson("p1", 0), lesson("r1", 1)];

    expect(hasFocusGain({ after, areaOf, areas: ["Portfolio"], before })).toBe(true);
  });

  it("is true when a plan short on time keeps more of the area", () => {
    const before = [lesson("p1", 0), lesson("r1", 1), lesson("r2", 2)];
    const after = [lesson("p1", 0), lesson("p2", 1), lesson("r1", 2)];

    expect(hasFocusGain({ after, areaOf, areas: ["Portfolio"], before })).toBe(true);
  });
});
