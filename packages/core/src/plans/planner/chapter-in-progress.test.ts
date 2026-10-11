import { describe, expect, it } from "vitest";
import { checkChapterInProgressKept } from "../_test-utils/rules/work-rules";
import { type PlanOperation } from "../plan-contract";
import { type BuildPlanInput, buildPlan } from "./build-plan";
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
  start,
}: {
  chapterSkillId: string;
  dailyMinutes: number;
  graph: PlanGraph;
  operations: PlanOperation[];
  prerequisites?: ReadonlyMap<string, readonly string[]>;
  start: Date;
}) {
  const targetDate = addDays(TODAY, 35);
  const settings = parsePlanSettings({ startDate: toIsoDate(start) });

  const input: BuildPlanInput = {
    goal: { dailyMinutes, kind: "exam", targetDate },
    graph: planGraph,
    items: [],
    lessons: toLessons(planGraph),
    mockMinutes: 180,
    mode: "forced",
    paceFactor: 1,
    prerequisites,
    readiness: new Map(),
    settings,
    today: start,
  };

  const shown = buildPlan(input).items.map((item, position) => {
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
      settings,
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
    shown: dayOf(shown),
  };
}

// ENEM 2083: "less essay" the day after an essay lesson took the chapter's next lesson out of
// today's session and put it two days later, behind physics (R10). The chapter finishes first.
describe("less of the subject of the chapter in progress while today is shown", () => {
  it("keeps the chapter's next lesson today", () => {
    const { after, context, shown } = steerMidChapter({
      chapterSkillId: "Redação-0",
      dailyMinutes: 45,
      graph,
      operations: [{ areas: ["Redação"], kind: "reduceAreas" }],
      prerequisites: new Map([["Redação-1", ["Redação-0"]]]),
      start: addDays(TODAY, -1),
    });

    expect(shown).toBe(toIsoDate(TODAY));
    expect(after).toBe(shown);
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
      const { after, shown } = steerMidChapter({
        chapterSkillId: "Natureza-0",
        dailyMinutes: 30,
        graph: cycleGraph,
        operations,
        start: addDays(TODAY, -2),
      });

      expect(shown).toBe("2026-10-13");
      expect(after).toBe(shown);
    },
  );
});
