import { describe, expect, it } from "vitest";
import { checkChapterInProgressKept } from "../_test-utils/rules/work-rules";
import { type PlanOperation } from "../plan-contract";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { findChapterInProgress } from "./chapter-in-progress";
import { addDays, toIsoDate } from "./plan-calendar";
import { applyPlanOperations } from "./plan-operations";
import { type PlanGraph, parsePlanSettings } from "./plan-state";

const TODAY = new Date("2026-10-12T00:00:00Z");
const HOUR_MS = 3_600_000;

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

describe("less of the subject of the chapter in progress while today is shown", () => {
  it("keeps the chapter's next lesson today", () => {
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
    expect(shown).toBe("2026-10-15");
    expect(after && shown && after <= shown).toBe(true);
    expect(checkChapterInProgressKept(context)).toStrictEqual([]);
  });
});

describe("a change of focus on another subject of a study cycle", () => {
  it.each([
    [[{ areas: ["Matemática"], kind: "focusAreas" }]],
    [[{ areas: ["Linguagens"], kind: "reduceAreas" }]],
  ] satisfies [PlanOperation[]][])(
    "keeps the chapter in progress's next lesson on its day: %j",
    (operations) => {
      const { after, context, inProgress, shown } = steerMidChapter({
        chapterSkillId: "Humanas-0",
        dailyMinutes: 30,
        graph: cycleGraph,
        operations,
        start: addDays(TODAY, -3),
      });

      expect(inProgress).toBe("chapter-Humanas-0");
      expect(shown).toBe("2026-10-15");
      expect(after && shown && after <= shown).toBe(true);
      expect(checkChapterInProgressKept(context)).toStrictEqual([]);
    },
  );
});
