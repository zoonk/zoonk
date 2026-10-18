import { describe, expect, it } from "vitest";
import { checkChapterInProgressKept } from "../_test-utils/rules/work-rules";
import { type PlanOperation } from "../plan-contract";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { findChapterInProgress } from "./chapter-in-progress";
import { addDays, toIsoDate } from "./plan-calendar";
import { applyPlanOperations } from "./plan-operations";
import { type PlanGraph, parsePlanSettings } from "./plan-state";

/** A Monday. */
const TODAY = new Date("2026-10-12T00:00:00Z");
const HOUR_MS = 3_600_000;

/** An ENEM-like exam: three subjects of two phases and the essay. */
const graph: PlanGraph = {
  phases: [
    { milestone: null, name: "Base" },
    { milestone: null, name: "Aprofundamento" },
  ],
  skills: [
    ...["Natureza", "Humanas", "Matemática"].flatMap((area) =>
      [0, 1].map((phase) => ({
        area,
        lessons: 6,
        name: `${area} ${phase}`,
        phase,
        skillId: `${area}-${phase}`,
        weight: 3,
      })),
    ),
    ...[0, 1].map((phase) => ({
      area: "Redação",
      lessons: 4,
      name: `Redação ${phase}`,
      outcome: true,
      phase,
      skillId: `Redação-${phase}`,
      weight: 4,
    })),
  ],
};

/** An exam of four subjects of two phases, each subject's skills a lesson bigger than the last's. */
const cycleGraph: PlanGraph = {
  phases: [
    { milestone: null, name: "Base" },
    { milestone: null, name: "Aprofundamento" },
  ],
  skills: ["Natureza", "Humanas", "Matemática", "Linguagens"].flatMap((area, index) =>
    [0, 1].map((phase) => ({
      area,
      lessons: 4 + index,
      name: `${area} ${phase}`,
      phase,
      skillId: `${area}-${phase}`,
      weight: 2 + index,
    })),
  ),
};

/** The Library's lessons for a graph: each skill's own chapter, 4 minutes each. */
function toLessons(plan: PlanGraph) {
  return plan.skills.flatMap((skill) =>
    Array.from({ length: skill.lessons }, (_, index) => ({
      chapterId: `chapter-${skill.skillId}`,
      lessonId: `${skill.skillId}-${index}`,
      minutes: 4,
      skillIds: [skill.skillId],
      title: `${skill.name} ${index}`,
    })),
  );
}

/**
 * A change of where to focus today on a plan laid out from `start`, whose lessons before today the
 * learner finished, one of `chapterSkillId` the last: its chapter is the one in progress. Returns
 * the day of that chapter's next lesson in the plan the learner saw and with the change, and the
 * step as the rule checks read it.
 */
function steerMidChapter({
  chapterSkillId,
  dailyMinutes,
  graph: planGraph,
  operations,
  prerequisites = new Map(),
  mockMinutes = 180,
  start,
}: {
  chapterSkillId: string;
  dailyMinutes: number;
  graph: PlanGraph;
  operations: PlanOperation[];
  prerequisites?: ReadonlyMap<string, readonly string[]>;
  /** The exam's weekly mock: longer than the day, the days before it fund it (see `fundMocks`). */
  mockMinutes?: number;
  start: Date;
}) {
  const targetDate = addDays(TODAY, 35);
  const settings = parsePlanSettings({ startDate: toIsoDate(start) });

  const input: BuildPlanInput = {
    goal: { dailyMinutes, kind: "exam", targetDate },
    graph: planGraph,
    items: [],
    lessons: toLessons(planGraph),
    mockMinutes,
    mode: "forced",
    paceFactor: 1,
    prerequisites,
    readiness: new Map(),
    settings,
    today: start,
  };

  const seen = buildPlan(input);

  const shown = seen.items.map((item, position) => {
    const saved = { ...item, id: `item-${position}`, position };
    const day = item.scheduledFor?.getTime() ?? Infinity;

    if (item.kind !== "lesson" || day >= TODAY.getTime()) {
      return saved;
    }

    const finishedAt = day + (item.skillId === chapterSkillId ? 2 : 1) * HOUR_MS;
    return { ...saved, completedAt: new Date(finishedAt), status: "done" as const };
  });

  const applied = applyPlanOperations({
    goalKind: "exam",
    operations,
    state: {
      goal: { dailyMinutes, targetDate: toIsoDate(targetDate) },
      graph: planGraph,
      // Saved with the plan the learner saw (see `commitPlan`), with its mocks' funding.
      settings: { ...settings, mockFunding: seen.mockFunding },
    },
    today: TODAY,
  });

  if (!("state" in applied)) {
    throw new Error("The change doesn't apply.");
  }

  const reduced = operations.flatMap((operation) =>
    operation.kind === "reduceAreas" ? operation.areas : [],
  );

  const after = buildPlan({
    ...input,
    carryOver: { lessonIds: [], todayExceptAreas: reduced },
    items: shown,
    settings: applied.state.settings,
    today: TODAY,
  }).items;

  const next = shown.find(
    (item) => item.chapterId === `chapter-${chapterSkillId}` && item.status === "todo",
  )?.lessonId;

  const dayOf = (items: readonly { lessonId: string | null; scheduledFor: Date | null }[]) => {
    const item = items.find((entry) => entry.lessonId === next);
    return item?.scheduledFor ? toIsoDate(item.scheduledFor) : null;
  };

  const plan = { goal: input.goal, graph: planGraph, settings: applied.state.settings };

  return {
    after: dayOf(after),
    context: {
      after: { ...plan, items: after, phases: [] },
      before: { ...plan, items: shown, phases: [] },
      changes: [],
      event: { kind: "learnerChange" as const, operations },
      today: TODAY,
      todayShown: true,
    },
    inProgress: findChapterInProgress(shown),
    shown: dayOf(shown),
  };
}

// ENEM 2083: "less essay" the day after an essay lesson took the chapter's next lesson out of
// today's session and put it two days later, behind physics (R10). The chapter finishes first.
describe("less of the subject of the chapter in progress while today is shown", () => {
  it("keeps the chapter's next lesson today", () => {
    // Two days in: the 180-minute weekly mock takes part of each 45-minute day (see `fundMocks`),
    // so the essay's first lesson is among the ones done before today.
    const { after, context, inProgress, shown } = steerMidChapter({
      chapterSkillId: "Redação-0",
      dailyMinutes: 45,
      graph,
      operations: [{ areas: ["Redação"], kind: "reduceAreas" }],
      prerequisites: new Map([["Redação-1", ["Redação-0"]]]),
      start: addDays(TODAY, -2),
    });

    expect(inProgress).toBe("chapter-Redação-0");
    expect(shown).toBe(toIsoDate(TODAY));
    expect(after).toBe(shown);
    expect(checkChapterInProgressKept(context)).toStrictEqual([]);
  });
});

// Four days into a plan whose 180-minute weekly mock the 45-minute days fund (see `fundMocks`):
// "less essay" put the essay chapter's next lesson a day after the one the learner saw (R10).
describe("less of the subject of the chapter in progress on funded days", () => {
  it("keeps the chapter's next lesson on the day the learner saw", () => {
    const { after, context, inProgress, shown } = steerMidChapter({
      chapterSkillId: "Redação-0",
      dailyMinutes: 45,
      graph,
      operations: [{ areas: ["Redação"], kind: "reduceAreas" }],
      prerequisites: new Map([["Redação-1", ["Redação-0"]]]),
      start: addDays(TODAY, -4),
    });

    expect(inProgress).toBe("chapter-Redação-0");
    expect(shown).toBe("2026-10-13");
    expect(after && shown && after <= shown).toBe(true);
    expect(checkChapterInProgressKept(context)).toStrictEqual([]);
  });
});

// Light days: a lesson spans several, so a chapter's next lesson has to start before its day.
// Without the mock's funding at 25 to 31 minutes a day, and with it on 25-minute days, a change
// put that lesson one or two days after the one the learner saw (R10).
describe("the chapter in progress on light days", () => {
  it.each([
    { back: 3, chapter: "Redação-0", minutes: 25, mock: 15 },
    { back: 5, chapter: "Redação-0", minutes: 25, mock: 15 },
    { back: 4, chapter: "Redação-0", minutes: 28, mock: 15 },
    { back: 4, chapter: "Redação-0", minutes: 31, mock: 15 },
  ])(
    "keeps the essay chapter's next lesson at $minutes minutes, $back days in",
    ({ back, chapter, minutes, mock }) => {
      const { after, context, inProgress, shown } = steerMidChapter({
        chapterSkillId: chapter,
        dailyMinutes: minutes,
        graph,
        mockMinutes: mock,
        operations: [{ areas: ["Redação"], kind: "reduceAreas" }],
        prerequisites: new Map([["Redação-1", ["Redação-0"]]]),
        start: addDays(TODAY, -back),
      });

      expect(inProgress).toBe(`chapter-${chapter}`);
      expect(after && shown && after <= shown).toBe(true);
      expect(checkChapterInProgressKept(context)).toStrictEqual([]);
    },
  );

  it("keeps the chapter's next lesson on 25-minute days that fund a mock", () => {
    const { after, context, inProgress, shown } = steerMidChapter({
      chapterSkillId: "Linguagens-0",
      dailyMinutes: 25,
      graph: cycleGraph,
      operations: [{ areas: ["Linguagens"], kind: "reduceAreas" }],
      start: addDays(TODAY, -2),
    });

    expect(inProgress).toBe("chapter-Linguagens-0");
    // Each 15-minute boss leads the study day after its lessons (see `placeBoss`), so they no
    // longer push this funded 25-minute schedule's chapter later.
    expect(shown).toBe("2026-10-15");
    expect(after && shown && after <= shown).toBe(true);
    expect(checkChapterInProgressKept(context)).toStrictEqual([]);
  });
});

// Câmara: a focus on constitutional law, or less English, shrank political science's turn in the
// study cycle, and the next lesson of the chapter the learner was in went a day later (R10). The
// subject of the chapter in progress keeps the time to reach it by the day the learner saw.
describe("a change of focus on another subject of a study cycle", () => {
  it.each([
    [[{ areas: ["Matemática"], kind: "focusAreas" }]],
    [[{ areas: ["Linguagens"], kind: "reduceAreas" }]],
  ] satisfies [PlanOperation[]][])(
    "keeps the chapter in progress's next lesson on its day: %j",
    (operations) => {
      // Three days in, in the middle of humanities' chapter: the weekly mock's funding makes each
      // day lighter (see `fundMocks`), so the cycle reaches it later than natural sciences' once did.
      const { after, context, inProgress, shown } = steerMidChapter({
        chapterSkillId: "Humanas-0",
        dailyMinutes: 30,
        graph: cycleGraph,
        operations,
        start: addDays(TODAY, -3),
      });

      expect(inProgress).toBe("chapter-Humanas-0");
      expect(shown).toBe("2026-10-15");
      // No later than the day the learner saw (R10): less of another subject may bring it sooner.
      expect(after && shown && after <= shown).toBe(true);
      expect(checkChapterInProgressKept(context)).toStrictEqual([]);
    },
  );
});
