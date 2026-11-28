import { describe, expect, it } from "vitest";
import { type MissionKind, type MissionPick } from "./catalog";
import { type DayMissionFacts } from "./day-facts";
import { pickMissions } from "./pick-missions";

const TODAY = new Date("2026-10-13T00:00:00Z");

function candidate(kind: MissionKind): MissionPick {
  const blockKind = {
    challenge: "checkpoint",
    essay: "produce",
    finishChapter: "learn",
    mock: "checkpoint",
    practice: "practice",
    review: "review",
    somethingNew: "learn",
    weakSpot: "practice",
    weeklyChallenge: "checkpoint",
  } as const;

  return {
    anchor: kind in blockKind ? { blockKind: blockKind[kind as keyof typeof blockKind] } : {},
    kind,
    total: 1,
  };
}

function facts(kinds: MissionKind[], overrides: Partial<DayMissionFacts> = {}): DayMissionFacts {
  return {
    available: true,
    blocks: [],
    candidates: kinds.map((kind) => candidate(kind)),
    firstSteps: null,
    localDate: TODAY,
    plannedMinutes: 20,
    recentPicks: [],
    ...overrides,
    dailyMinutes: overrides.dailyMinutes ?? overrides.plannedMinutes ?? 30,
  };
}

function picks(kinds: MissionKind[], overrides: Partial<DayMissionFacts> = {}) {
  return pickMissions(facts(kinds, overrides)).map((pick) => pick.kind);
}

describe(pickMissions, () => {
  it("starts with remember and new, then the day's distinctive work", () => {
    expect(picks(["review", "somethingNew", "essay", "practice"])).toStrictEqual([
      "review",
      "somethingNew",
      "essay",
    ]);
  });

  it("finishes a chapter instead of offering a generic new lesson", () => {
    expect(picks(["review", "somethingNew", "finishChapter", "essay"])).toStrictEqual([
      "review",
      "finishChapter",
      "essay",
    ]);
  });

  it.each([
    ["challenge", ["mock", "weeklyChallenge", "essay"]],
    ["mock", ["weeklyChallenge", "essay"]],
    ["weeklyChallenge", ["essay"]],
    ["essay", ["practice"]],
  ] as [MissionKind, MissionKind[]][])("prioritizes %s", (kind, lower) => {
    expect(picks(["review", "somethingNew", ...lower, kind])).toStrictEqual([
      "review",
      "somethingNew",
      kind,
    ]);
  });

  it("uses an available first step before the rotation", () => {
    const input = facts(["review", "somethingNew", "askBuddy", "call"]);

    input.firstSteps = {
      done: 2,
      steps: [
        { kind: "somethingNew", status: "done" },
        { kind: "review", status: "done" },
        { kind: "askBuddy", opens: { kind: "buddy" }, status: "available" },
      ],
      total: 3,
    };

    expect(pickMissions(input).at(-1)).toMatchObject({ firstStep: true, kind: "askBuddy" });
  });

  it("marks first lessons and reviews without offering the same step twice", () => {
    const input = facts(["review", "somethingNew", "askBuddy"]);

    input.firstSteps = {
      done: 0,
      steps: [
        { kind: "somethingNew", status: "available" },
        { kind: "review", status: "available" },
        { kind: "askBuddy", status: "available" },
      ],
      total: 3,
    };

    expect(
      pickMissions(input)
        .filter((pick) => pick.firstStep)
        .map((pick) => pick.kind),
    ).toStrictEqual(["review", "somethingNew", "askBuddy"]);
  });

  it("offers the least recently offered kind", () => {
    expect(
      picks(["review", "somethingNew", "pronunciation", "call", "askBuddy"], {
        recentPicks: [["pronunciation"], ["call"], ["askBuddy"]],
      }),
    ).toStrictEqual(["review", "somethingNew", "askBuddy"]);
  });

  it("favors a kind never offered within the last seven sessions", () => {
    expect(
      picks(["review", "somethingNew", "pronunciation", "call"], {
        recentPicks: [["pronunciation"]],
      }),
    ).toStrictEqual(["review", "somethingNew", "call"]);
  });

  it("breaks rotation ties in catalog order", () => {
    expect(
      picks(["review", "somethingNew", "askBuddy", "call", "pronunciation", "practice"]),
    ).toStrictEqual(["review", "somethingNew", "practice"]);
  });

  it("fills absent slots without repeating a kind", () => {
    expect(picks(["pronunciation", "call", "askBuddy"])).toStrictEqual([
      "call",
      "askBuddy",
      "pronunciation",
    ]);
  });

  it("does not offer practice and weak-area practice for the same block", () => {
    expect(picks(["practice", "weakSpot", "call"])).toHaveLength(2);
  });

  it("keeps short days to two planned missions", () => {
    expect(
      picks(["review", "somethingNew", "essay", "askBuddy"], { plannedMinutes: 14 }),
    ).toStrictEqual(["review", "somethingNew"]);
  });

  it("fills short days only with planned work", () => {
    expect(
      picks(["somethingNew", "essay", "askBuddy", "call"], { plannedMinutes: 10 }),
    ).toStrictEqual(["essay", "somethingNew"]);
  });

  it("gives a short day without planned missions one small mission outside the day", () => {
    expect(picks(["askBuddy", "call"], { dailyMinutes: 30, plannedMinutes: 10 })).toStrictEqual([
      "call",
    ]);
  });

  it("does not offer weak-area practice on short days", () => {
    expect(picks(["review", "weakSpot"], { plannedMinutes: 14 })).toStrictEqual(["review"]);
  });

  it.each([0, -1])("offers nothing on an empty %i-minute day", (plannedMinutes) => {
    expect(picks(["review", "somethingNew"], { plannedMinutes })).toStrictEqual([]);
  });

  it("offers nothing on a rest, paused or limit day", () => {
    expect(picks(["review", "somethingNew"], { available: false })).toStrictEqual([]);
  });

  it("is deterministic and leaves its inputs unchanged", () => {
    const input = facts(["review", "call", "pronunciation", "askBuddy"]);
    const before = structuredClone(input);
    expect(pickMissions(input)).toStrictEqual(pickMissions(input));
    expect(input).toStrictEqual(before);
  });
});
