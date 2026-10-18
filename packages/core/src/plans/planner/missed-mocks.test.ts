import { describe, expect, it } from "vitest";
import { checkMocksInEveryPhase } from "../_test-utils/rules/day-rules";
import { type BuildPlanInput, type BuiltPlan, buildPlan } from "./build-plan";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type ExistingPlanItem, type PlannedItem } from "./plan-items";
import { toExamWindows } from "./plan-phases";
import { type PlanGraph, type PlanPhase, parsePlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";

/** A Monday. */
const TODAY = new Date("2026-10-12T00:00:00Z");

function listLessons(graph: PlanGraph, minutes: number): PlannerLesson[] {
  return graph.skills.flatMap((skill) =>
    Array.from({ length: skill.lessons }, (_, index) => ({
      chapterId: `chapter-${skill.skillId}`,
      lessonId: `${skill.skillId}-${index}`,
      minutes,
      skillIds: [skill.skillId],
      title: `${skill.name} ${index}`,
    })),
  );
}

/** An ENEM-like exam: three subjects of two phases. */
const examGraph: PlanGraph = {
  phases: [
    { milestone: null, name: "Base" },
    { milestone: null, name: "Aprofundamento" },
  ],
  skills: ["Natureza", "Humanas", "Matemática"].flatMap((area) =>
    [0, 1].map((phase) => ({
      area,
      lessons: 12,
      name: `${area} ${phase}`,
      phase,
      skillId: `${area}-${phase}`,
      weight: 3,
    })),
  ),
};

/** A biology class test from the learner's slides: one subject, a few short topics. */
const classTestGraph: PlanGraph = {
  phases: [
    { milestone: null, name: "Células" },
    { milestone: null, name: "Organelas" },
  ],
  skills: ["Teoria celular", "Membrana", "Vírus", "Osmose", "Organelas", "Núcleo"].map(
    (name, index) => ({
      area: "Biologia celular",
      lessons: 3,
      name,
      phase: index < 3 ? 0 : 1,
      skillId: name,
      weight: 3,
    }),
  ),
};

/** The plan's items as saved, with their ids and places, as the next run reads them. */
function toSaved(items: readonly PlannedItem[]): ExistingPlanItem[] {
  return items.map((item, position) => ({ ...item, id: `item-${position}`, position }));
}

type SavedPlan = { input: BuildPlanInput; items: ExistingPlanItem[]; phases: PlanPhase[] };

/** An exam plan as made on its first day (`TODAY`). */
function makePlan({
  dailyMinutes,
  daysAway,
  graph,
  lessonMinutes,
  mockMinutes,
  shortMockMinutes = null,
}: {
  dailyMinutes: number;
  daysAway: number;
  graph: PlanGraph;
  lessonMinutes: number;
  mockMinutes: number;
  /** A class test's own short mock; null for a public exam. */
  shortMockMinutes?: number | null;
}): SavedPlan {
  const input: BuildPlanInput = {
    goal: { dailyMinutes, kind: "exam", targetDate: addDays(TODAY, daysAway) },
    graph,
    items: [],
    lessons: listLessons(graph, lessonMinutes),
    mockMinutes,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ shortMockMinutes, startDate: toIsoDate(TODAY) }),
    today: TODAY,
  };

  const built = buildPlan(input);
  return { input, items: toSaved(built.items), phases: built.phases };
}

/**
 * The first run on the day the learner comes back after missing days, with nothing studied since
 * the plan was made: it carries the lessons the days before left and keeps the phases they see.
 */
function settleOn({ plan, today }: { plan: SavedPlan; today: Date }): BuiltPlan {
  const left = plan.items.filter(
    (item) =>
      item.status === "todo" &&
      item.kind === "lesson" &&
      item.scheduledFor !== null &&
      item.scheduledFor < today,
  );

  return buildPlan({
    ...plan.input,
    carryOver: { itemIds: left.map((item) => item.id), lessonIds: [] },
    examWindows: toExamWindows(plan.phases),
    items: plan.items,
    setAsideLeftWork: true,
    today,
  });
}

/** What the check of a mock in every phase (R24) finds in a settled plan. */
function checkMocks({
  plan,
  settled,
  today,
}: {
  plan: SavedPlan;
  settled: BuiltPlan;
  today: Date;
}) {
  return checkMocksInEveryPhase({
    after: {
      goal: plan.input.goal,
      graph: plan.input.graph,
      items: settled.items,
      phases: settled.phases,
      settings: plan.input.settings,
    },
    before: null,
    event: { kind: "newDay", studied: false },
    today,
  });
}

/** The days of the plan's mocks still to come, from `today` on. */
function listMockDays({
  items,
  today,
}: {
  items: readonly Pick<PlannedItem, "kind" | "scheduledFor">[];
  today: Date;
}) {
  return items.flatMap((item) =>
    item.kind === "mock" && item.scheduledFor && item.scheduledFor >= today
      ? [toIsoDate(item.scheduledFor)]
      : [],
  );
}

describe("a phase whose weekly mocks the learner missed", () => {
  // OAB at 170 minutes and Câmara at 15 missed every weekly mock of their foundations; the next
  // morning's settling left the phase's last days with no mock.
  it("gets a mock of its own on its last day", () => {
    const plan = makePlan({
      dailyMinutes: 180,
      daysAway: 92,
      graph: examGraph,
      lessonMinutes: 5,
      mockMinutes: 180,
    });

    const [foundations] = toExamWindows(plan.phases);

    if (!foundations) {
      throw new Error("Expected the foundations phase");
    }

    const end = toIsoDate(foundations.endDate);
    const weekly = listMockDays({ items: plan.items, today: TODAY }).filter((day) => day <= end);
    const lastWeekly = weekly.at(-1);

    if (!lastWeekly) {
      throw new Error("Expected the foundations' weekly mocks");
    }

    // Back the day after the last of them, with the phase's last days still ahead.
    const today = addDays(fromIsoDate(lastWeekly), 1);
    const settled = settleOn({ plan, today });

    expect(today.getTime()).toBeLessThan(foundations.endDate.getTime());

    expect(listMockDays({ items: settled.items, today }).filter((day) => day <= end)).toStrictEqual(
      [end],
    );

    expect(checkMocks({ plan, settled, today })).toStrictEqual([]);
  });
});

describe("a class test whose one mock the learner missed", () => {
  // Class test seed 1016: 12 days away, the learner missed the days around the plan's one mock and
  // came back two days before the test; the settling dropped the mock. Class test seed 1030: 14
  // days away at 15 minutes, the missed mock came back on the last lesson day, where its 30
  // minutes pushed the rest of the chapter in progress out. It goes on the day before, with the
  // review.
  it.each([
    { back: 9, dailyMinutes: 20, daysAway: 12 },
    { back: 7, dailyMinutes: 15, daysAway: 14 },
  ])(
    "rehearses on the day before the test, back $back days into a test $daysAway days away",
    ({ back, dailyMinutes, daysAway }) => {
      const plan = makePlan({
        dailyMinutes,
        daysAway,
        graph: classTestGraph,
        lessonMinutes: 4,
        mockMinutes: 15,
        shortMockMinutes: 30,
      });

      const today = addDays(TODAY, back);

      // The plan's one mock was on a day the learner missed.
      expect(
        plan.items.filter((item) => item.kind === "mock").map((item) => item.scheduledFor),
      ).toStrictEqual([expect.any(Date)]);

      expect(listMockDays({ items: plan.items, today })).toStrictEqual([]);

      const settled = settleOn({ plan, today });

      expect(listMockDays({ items: settled.items, today })).toStrictEqual([
        toIsoDate(addDays(TODAY, daysAway - 1)),
      ]);

      expect(checkMocks({ plan, settled, today })).toStrictEqual([]);
    },
  );
});
