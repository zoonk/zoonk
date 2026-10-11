import { describe, expect, it } from "vitest";
import { type BuildPlanInput } from "../planner/build-plan";
import { type ExistingPlanItem } from "../planner/plan-items";
import { parsePlanSettings } from "../planner/plan-state";
import { getPlanInputsKey, isOnlyLanding } from "./plan-inputs-key";

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

/** Every field a run reads, so a field added to the input has to be added here too. */
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
  bringBackSetAside: true,
  carryOver: { lessonIds: ["fractions-0"] },
  examWindows: [{ endDate: TODAY, kind: "finalStretch", startDate: TODAY }],
  fullMockMinutes: 300,
  goal: { dailyMinutes: 30, kind: "exam", targetDate: new Date("2026-12-18T00:00:00Z") },
  graph: {
    phases: [{ milestone: null, name: "Basics" }],
    skills: [
      { area: "Math", lessons: 2, name: "Fractions", phase: 0, skillId: "fractions", weight: 1 },
      { area: "Math", lessons: 2, name: "Ratios", phase: 0, skillId: "ratios", weight: 1 },
    ],
  },
  items: [],
  knownAreas: new Set(["Math"]),
  knownSkillIds: new Set(["fractions", "ratios"]),
  landedOnly: true,
  lessons,
  levelFloor: "beginner",
  missedSkillIds: new Set(["ratios"]),
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
  setAsideLeftWork: true,
  settings: parsePlanSettings({ startDate: "2026-10-12" }),
  strongAreas: new Set(["Math"]),
  today: TODAY,
  todayShown: true,
  topicLevels: [{ level: "high", subject: "Math", topic: "Ratios" }],
};

/** What only says how a run was made, which the plan it saved already holds. */
const RUN_FIELDS = new Set([
  "bringBackSetAside",
  "carryOver",
  "examWindows",
  "items",
  "landedOnly",
  "mode",
  "movesPhaseEnds",
  "phaseEnds",
  "setAsideLeftWork",
  "today",
  "todayShown",
]);

const item = { key: "lesson:fractions-0" };

const key = getPlanInputsKey({ input, items: [] });

describe(getPlanInputsKey, () => {
  it("reads the same inputs the same way, however their sets and maps are ordered", () => {
    const reordered = { ...input, knownSkillIds: new Set(["ratios", "fractions"]) };
    expect(getPlanInputsKey({ input: reordered, items: [] })).toBe(key);
  });

  it.each(Object.keys(input))("reads %s, or says why it leaves it out", (field) => {
    const without = { ...input, [field]: undefined };
    const changed = getPlanInputsKey({ input: without, items: [] }) !== key;

    expect(changed).toBe(!RUN_FIELDS.has(field));
  });

  // A run reads the counts the build before it saved and saves its own, so a key that read them
  // missed on the next refresh whenever a change moved them, and nothing new was planned again.
  it("leaves out the lessons the last build counted for each skill", () => {
    const counted = {
      ...input,
      graph: {
        ...input.graph,
        skills: input.graph.skills.map((skill) => ({ ...skill, plannedLessons: 6 })),
      },
    };

    expect(getPlanInputsKey({ input: counted, items: [] })).toBe(key);
  });

  it("reads the learner's progress, but not the plan's work still to do", () => {
    expect(getPlanInputsKey({ input, items: [{ ...item, status: "todo" }] })).toBe(key);
    expect(getPlanInputsKey({ input, items: [{ ...item, status: "done" }] })).not.toBe(key);
  });

  // An outline that also places a lesson written before in its new chapter can give the lesson that
  // chapter and move it in the course order: a career plan's day-one landing read as more news.
  it("reads a lesson's chapter and its place in the course order as no news", () => {
    const [first, second, ...rest] = lessons;

    const placed = {
      ...input,
      lessons: [{ ...second!, chapterId: "chapter-new" }, first!, ...rest],
    };

    expect(getPlanInputsKey({ input: placed, items: [] })).toBe(key);
  });
});

describe(isOnlyLanding, () => {
  const standIn: ExistingPlanItem = {
    chapterId: null,
    completedAt: null,
    id: "stand-in",
    kind: "lesson",
    lessonId: null,
    phase: 0,
    position: 0,
    scheduledFor: TODAY,
    skillId: "ratios",
    status: "todo",
    titleSnapshot: "Ratios",
  };

  /** A plan saved before the Library wrote the ratios lessons: ratios is a stand-in. */
  const saved: BuildPlanInput = {
    goal: { dailyMinutes: 30, kind: "learn", targetDate: null },
    graph: input.graph,
    items: [standIn],
    lessons: lessons.filter((lesson) => lesson.skillIds.includes("fractions")),
    mockMinutes: 150,
    mode: "automatic",
    paceFactor: 1,
    prerequisites: new Map([["ratios", ["fractions"]]]),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: "2026-10-12" }),
    today: TODAY,
  };

  const savedKey = getPlanInputsKey({ input: saved, items: [] });
  const landed = { ...saved, lessons };

  it("reads a run whose only news is lessons written for the plan's stand-ins", () => {
    expect(isOnlyLanding({ input: landed, savedKey })).toBe(true);
  });

  it("reads a landing with anything else new as more than a landing", () => {
    const longer = { ...landed, goal: { ...landed.goal, dailyMinutes: 45 } };

    const studied = {
      ...landed,
      items: [standIn, { ...standIn, id: "done", status: "done" as const }],
    };

    expect(isOnlyLanding({ input: longer, savedKey })).toBe(false);
    expect(isOnlyLanding({ input: studied, savedKey })).toBe(false);
    expect(isOnlyLanding({ input: { ...landed, mode: "forced" }, savedKey })).toBe(false);
    expect(isOnlyLanding({ input: landed, savedKey: null })).toBe(false);
  });
});
