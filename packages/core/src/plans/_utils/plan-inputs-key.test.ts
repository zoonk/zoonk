import { describe, expect, it } from "vitest";
import { type BuildPlanInput } from "../planner/build-plan";
import { type ExistingPlanItem } from "../planner/plan-items";
import { parsePlanSettings } from "../planner/plan-state";
import { getPlanInputsKey, readLanding } from "./plan-inputs-key";

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
  goal: { dailyMinutes: 30, kind: "exam", targetDate: new Date("2026-12-18T00:00:00Z") },
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
  keepSelection: false,
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
  settings: parsePlanSettings({ startDate: "2026-10-12" }),
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

/** What only says how a run was made, which the plan it saved already holds. */
const RUN_FIELDS = new Set([
  "bringBackSetAside",
  "carryOver",
  "examWindows",
  "goalId",
  "heldSkillsLand",
  "items",
  "keepSelection",
  "landedOnly",
  "mode",
  "movesPhaseEnds",
  "phaseEnds",
  "requestedMoveDates",
  "setAsideLeftWork",
  "testedTeaching",
  "today",
  "todayShown",
]);

const item = { key: "lesson:fractions-0" };

const key = getPlanInputsKey({ input, items: [] });

describe(getPlanInputsKey, () => {
  // The scope and placement keys share its reading (`readKeyedInput`, `hashKeyed`): sharing it
  // changed no stored key, so a plan saved before still reads as unchanged.
  it("keeps the bytes of the keys plans were saved with", () => {
    expect(getPlanInputsKey({ input, items: [{ ...item, status: "done" }] })).toBe(
      "d963076eec90be5f7caa22cf68020899712fc712b284e1603769dc682b7942cb",
    );
  });

  it("changes when a course start gives the first day its full lesson budget", () => {
    expect(getPlanInputsKey({ input: { ...input, courseStart: true }, items: [] })).not.toBe(key);
  });

  // The first exam day's clock sizes `mockMinutes`; the second day's mocks are sized by their own.
  it("changes when an exam day's mock clock does, the first day's unchanged", () => {
    const clocks = [
      { day: 1, fullMinutes: 300, minutes: 150 },
      { day: 2, fullMinutes: 300, minutes: 150 },
    ];

    const before = getPlanInputsKey({ input: { ...input, mockClocks: clocks }, items: [] });

    const after = getPlanInputsKey({
      input: { ...input, mockClocks: [clocks[0]!, { day: 2, fullMinutes: 330, minutes: 165 }] },
      items: [],
    });

    expect(after).not.toBe(before);
  });

  // The day a lesson was finished is fixed once it's done: a new day reads the same key, and the
  // learner's day moving (another time zone) dates it again.
  it("reads the day each finished lesson was done, the same whatever day the run plans", () => {
    const nextDay = new Date(TODAY.getTime() + 86_400_000);
    const moved = new Map([["item-fractions-0", nextDay]]);

    expect(getPlanInputsKey({ input: { ...input, today: nextDay }, items: [] })).toBe(key);
    expect(getPlanInputsKey({ input: { ...input, finishedOn: moved }, items: [] })).not.toBe(key);
  });

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

describe(readLanding, () => {
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

  /** A plan that holds the first ratios lesson, and a stand-in for the rest of the skill. */
  const held: BuildPlanInput = {
    ...saved,
    graph: {
      ...saved.graph,
      skills: saved.graph.skills.map((skill) => ({ ...skill, lessons: 6 })),
    },
    items: [
      { ...standIn, id: "ratios-0", lessonId: "ratios-0", titleSnapshot: "ratios 0" },
      { ...standIn, position: 1 },
    ],
    lessons: lessons.filter((lesson) => lesson.lessonId !== "ratios-1"),
  };

  it("reads a run whose only news is lessons written for the plan's stand-ins", () => {
    expect(readLanding({ input: landed, savedKey })).toMatchObject({ landedOnly: true });
  });

  it("reads a landing with anything else new as more than a landing", () => {
    const longer = { ...landed, goal: { ...landed.goal, dailyMinutes: 45 } };

    const studied = {
      ...landed,
      items: [standIn, { ...standIn, id: "done", status: "done" as const }],
    };

    expect(readLanding({ input: longer, savedKey })).toStrictEqual({ landedOnly: false });
    expect(readLanding({ input: studied, savedKey })).toStrictEqual({ landedOnly: false });

    expect(readLanding({ input: { ...landed, mode: "forced" }, savedKey })).toStrictEqual({
      landedOnly: false,
    });

    expect(readLanding({ input: landed, savedKey: null })).toStrictEqual({ landedOnly: false });
  });

  it("lands a skill's next chapter, written since, though the plan holds lessons of it", () => {
    const heldKey = getPlanInputsKey({ input: held, items: [] });

    expect(readLanding({ input: { ...held, lessons }, savedKey: heldKey })).toStrictEqual({
      heldSkillsLand: true,
      landedOnly: true,
    });
  });

  // An OAB plan's day-one landing read lessons its cut left out as written since.
  it("never reads a lesson the plan was saved without, but knew, as written since", () => {
    const heldKey = getPlanInputsKey({ input: { ...held, lessons }, items: [] });

    expect(readLanding({ input: { ...held, lessons }, savedKey: heldKey })).toStrictEqual({
      landedOnly: false,
    });
  });
});
