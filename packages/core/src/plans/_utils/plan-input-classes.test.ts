import { describe, expect, it } from "vitest";
import { type BuildPlanInput } from "../planner/build-plan";
import { parsePlanSettings } from "../planner/plan-state";
import {
  comparePlanInputs,
  getPlanInputKeys,
  readLayoutKeys,
  readPendingPace,
} from "./plan-input-classes";
import { getPlanInputsKey } from "./plan-inputs-key";

/** A Monday. */
const TODAY = new Date("2026-10-12T00:00:00Z");

const lessons = ["fractions", "ratios"].flatMap((skillId) =>
  [0, 1].map((index) => ({
    chapterId: `chapter-${skillId}`,
    lessonId: `${skillId}-${index}`,
    minutes: 5,
    skillIds: [skillId],
    title: `${skillId} ${index}`,
  })),
);

/**
 * Every field a run reads, so a field added to the input has to be added here too. A learn goal:
 * an exam's missed-mock rescue is placement too, whatever field it reads (see the time audit).
 */
const input: Required<BuildPlanInput> = {
  announcements: ["Essay on ratios"],
  answeredWrongSkillIds: new Set(["ratios"]),
  bands: new Map([["fractions", "beginner"]]),
  bases: [
    {
      area: "Math",
      known: false,
      minutes: { deep: 20, essential: 10, quick: 5 },
      name: "Fractions",
      neededFor: ["ratios"],
      skillId: "fractions",
    },
  ],
  bossDays: new Map([["boss:0", { beside: false, date: "2026-10-16" }]]),
  bossFacts: {
    bank: { recordingSets: [], textCounts: new Map([["fractions", 12]]) },
    listeningSkillIds: new Set(),
    rows: { chapterLessons: [], lessonSkills: [] },
    survivors: new Map(),
  },
  bossMinutes: new Map([["boss:0", 15]]),
  bringBackSetAside: true,
  carryOver: { lessonIds: ["fractions-0"] },
  courseStart: false,
  examWindows: [{ endDate: TODAY, kind: "finalStretch", startDate: TODAY }],
  finishedOn: new Map([["item-fractions-0", TODAY]]),
  fullMockMinutes: 300,
  goal: { dailyMinutes: 30, kind: "learn", targetDate: new Date("2026-12-18T00:00:00Z") },
  goalId: "goal-1",
  graph: {
    phases: [{ milestone: null, name: "Basics" }],
    skills: [
      { area: "Math", lessons: 2, name: "Fractions", phase: 0, skillId: "fractions", weight: 1 },
      { area: "Math", lessons: 2, name: "Ratios", phase: 0, skillId: "ratios", weight: 1 },
    ],
  },
  heldSkillsLand: true,
  items: [],
  knownAreas: new Set(["Math"]),
  knownSkillIds: new Set(["fractions", "ratios"]),
  landedOnly: true,
  lessons,
  levelFloor: "beginner",
  missedSkillIds: new Set(["ratios"]),
  mockClocks: [{ day: 1, fullMinutes: 300, minutes: 150 }],
  mockMinutes: 150,
  mode: "forced",
  movesPhaseEnds: true,
  noticeAreas: new Set(["Math"]),
  paceFactor: 1,
  phaseEnds: new Map([[0, TODAY]]),
  prerequisites: new Map([["ratios", ["fractions"]]]),
  quickLessons: new Map([["fractions", lessons[0]!]]),
  readiness: new Map([
    ["fractions", { retrievabilityAtTarget: 0.5, stability: 3, state: "learning" as const }],
  ]),
  requestedMoveDates: new Set(["2026-10-16"]),
  setAsideLeftWork: true,
  settings: parsePlanSettings({
    baseChoices: [{ choice: "deep", skillId: "fractions" }],
    examChoices: [{ group: "Foreign language", subject: "English" }],
    focusAreas: ["Math"],
    focusParts: [{ area: "Math", name: "Fractions", skillIds: ["fractions"] }],
    lightWeeks: [{ endDate: "2026-11-08", startDate: "2026-11-02" }],
    mockFunding: [{ contributions: [], date: "2026-10-18", minutes: 150 }],
    mockRelocations: [{ from: "2026-10-18", to: "2026-10-19" }],
    movedEvents: [{ from: "2026-10-25", to: "2026-10-26" }],
    noticeDate: "2026-12-18",
    pace: { factor: 1.2, source: "own" },
    pastBasicsAreas: ["Math"],
    reducedAreas: ["Math"],
    shortMockMinutes: 60,
    skippedActivities: ["writing"],
    skippedAreas: ["History"],
    startDate: "2026-10-12",
    team: { language: "en", members: [{ name: "Ana" }] },
    tools: [{ choice: "have", name: "Excel", setupSkillId: null, system: null }],
    weekdayMinutes: [0, 30, 30, 30, 30, 30, 60],
  }),
  strongAreas: new Set(["Math"]),
  testedTeaching: [
    {
      date: "2026-10-20",
      lessons: new Map([["lesson:fractions-0", new Map([["2026-10-19", 4]])]]),
    },
  ],
  today: TODAY,
  todayShown: true,
  topicLevels: [{ level: "high", subject: "Math", topic: "Ratios" }],
};

/** What only says how a run was made, or never reshuffles a plan on its own. */
const NEITHER_FIELDS = new Set([
  "bringBackSetAside",
  "carryOver",
  "examWindows",
  "finishedOn",
  "goalId",
  "heldSkillsLand",
  "items",
  "landedOnly",
  "mode",
  "movesPhaseEnds",
  "phaseEnds",
  "readiness",
  "requestedMoveDates",
  "setAsideLeftWork",
  "testedTeaching",
  "today",
  "todayShown",
]);

const PLACEMENT_FIELDS = new Set([
  "bossDays",
  "bossMinutes",
  "courseStart",
  "mockClocks",
  "paceFactor",
]);

const PLACEMENT_SETTINGS = new Set(["mockFunding", "mockRelocations", "movedEvents", "pace"]);
const NEITHER_SETTINGS = new Set(["checkpointOverflow", "team"]);

const placement = { leftWork: [] };
const keys = getPlanInputKeys({ input, items: [], placement });

/** Which of the two keys a changed input moves. */
function changedKeys(changed: BuildPlanInput) {
  const after = getPlanInputKeys({ input: changed, items: [], placement });
  return { placement: after.placement !== keys.placement, scope: after.scope !== keys.scope };
}

describe(getPlanInputKeys, () => {
  it("reads a fixture whose settings all parsed", () => {
    expect(input.settings).toMatchObject({
      examChoices: [{ subject: "English" }],
      startDate: "2026-10-12",
      team: { language: "en" },
      tools: [{ name: "Excel" }],
      weekdayMinutes: [0, 30, 30, 30, 30, 30, 60],
    });
  });

  it.each(Object.keys(input).filter((field) => field !== "settings"))(
    "reads %s in its class's key, or in neither",
    (field) => {
      const changed = changedKeys({ ...input, [field]: undefined });
      const isPlacement = PLACEMENT_FIELDS.has(field);
      const isNeither = NEITHER_FIELDS.has(field);

      expect(changed).toStrictEqual({ placement: isPlacement, scope: !isPlacement && !isNeither });
    },
  );

  it.each(Object.keys(input.settings))(
    "reads settings.%s in its class's key, or in neither",
    (field) => {
      const changed = changedKeys({
        ...input,
        settings: { ...input.settings, [field]: undefined },
      });

      const isPlacement = PLACEMENT_SETTINGS.has(field);

      expect(changed).toStrictEqual({
        placement: isPlacement,
        scope: !isPlacement && !NEITHER_SETTINGS.has(field),
      });
    },
  );

  it("reads tested-out and set-aside work as scope, done work as neither", () => {
    const item = { key: "lesson:fractions-0" };

    const read = (status: "done" | "skipped" | "testedOut" | "todo") =>
      getPlanInputKeys({ input, items: [{ ...item, status }], placement });

    expect(read("todo")).toStrictEqual(keys);
    expect(read("done")).toStrictEqual(keys);
    expect(read("testedOut").scope).not.toBe(keys.scope);
    expect(read("skipped").scope).not.toBe(keys.scope);
    expect(read("skipped").placement).toBe(keys.placement);
  });

  it("reads the work earlier days left, in its order, as placement", () => {
    const left = getPlanInputKeys({ input, items: [], placement: { leftWork: ["a", "b"] } });
    const reordered = getPlanInputKeys({ input, items: [], placement: { leftWork: ["b", "a"] } });

    expect(left.scope).toBe(keys.scope);
    expect(left.placement).not.toBe(keys.placement);
    expect(reordered.placement).not.toBe(left.placement);
  });

  it("reads the same inputs the same way, however their sets and maps are ordered", () => {
    const reordered = { ...input, knownSkillIds: new Set(["ratios", "fractions"]) };
    expect(getPlanInputKeys({ input: reordered, items: [], placement })).toStrictEqual(keys);
  });
});

describe(comparePlanInputs, () => {
  const stored = { inputsKey: null, layoutKeys: keys };

  const compare = (
    changed: BuildPlanInput,
    saved: { inputsKey: string | null; layoutKeys: unknown } = stored,
  ) => comparePlanInputs({ input: changed, items: [], placement, stored: saved });

  it("finds nothing to plan when both keys are the stored ones", () => {
    expect(compare(input)).toStrictEqual({ kind: "equal" });
  });

  it("re-places the same selection when only its placement moved", () => {
    expect(compare({ ...input, paceFactor: 1.4 })).toMatchObject({ kind: "placement" });
  });

  it("reselects when what the plan selects changed, placement or not", () => {
    expect(compare({ ...input, goal: { ...input.goal, dailyMinutes: 45 } })).toMatchObject({
      kind: "scope",
    });

    expect(compare({ ...input, missedSkillIds: new Set(), paceFactor: 1.4 })).toMatchObject({
      kind: "scope",
    });
  });

  it("keys a plan saved before the keys without building when its legacy key still matches", () => {
    const legacy = { inputsKey: getPlanInputsKey({ input, items: [] }), layoutKeys: null };

    expect(compare(input, legacy)).toStrictEqual({ keys, kind: "rekey" });

    expect(compare(input, { ...legacy, layoutKeys: { ...keys, version: 0 } })).toMatchObject({
      kind: "rekey",
    });

    expect(compare({ ...input, paceFactor: 1.4 }, legacy)).toMatchObject({ kind: "scope" });

    // Work earlier days left isn't in the legacy key: taken as keyed, it would never be laid out.
    expect(
      comparePlanInputs({
        input,
        items: [],
        placement: { leftWork: ["lesson:late"] },
        stored: legacy,
      }),
    ).toMatchObject({ kind: "placement" });

    expect(compare(input, { inputsKey: null, layoutKeys: null })).toMatchObject({ kind: "scope" });
  });
});

describe(readLayoutKeys, () => {
  it("reads keys of this classification only", () => {
    expect(readLayoutKeys(keys)).toStrictEqual(keys);
    expect(keys.version).toBe(1);
    expect(readLayoutKeys({ ...keys, version: 2 })).toBeNull();
    expect(readLayoutKeys(null)).toBeNull();
  });
});

describe(readPendingPace, () => {
  it("reads a waiting pace with the settings' own schema", () => {
    expect(readPendingPace({ factor: 1.3, source: "own" })).toStrictEqual({
      factor: 1.3,
      source: "own",
    });

    expect(readPendingPace(null)).toBeNull();
    expect(readPendingPace({ factor: -1, source: "own" })).toBeNull();
  });
});
