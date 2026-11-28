import { describe, expect, it } from "vitest";
import { holdsSchedule } from "../_utils/mock-replan-guard";
import { findPlanSuggestion } from "../_utils/suggested-time";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { getPlanFeasibility } from "./plan-feasibility";
import { type ExistingPlanItem } from "./plan-items";
import { parsePlanSettings } from "./plan-state";
import { summarizeSelectedPlan } from "./selected-plan-summary";
import { type MockMiss, getExamValue } from "./skill-order";

const TODAY = fromIsoDate("2026-10-07");
const TOPICS = ["fractions", "ratios", "percentages", "equations"];

function examInput(mockMisses?: ReadonlyMap<string, MockMiss>): BuildPlanInput {
  return {
    goal: { dailyMinutes: 30, kind: "exam", targetDate: addDays(TODAY, 60) },
    graph: {
      phases: [{ milestone: null, name: "Base" }],
      skills: TOPICS.map((skillId) => ({
        area: "Math",
        lessons: 3,
        name: skillId,
        phase: 0,
        skillId,
        weight: 3,
      })),
    },
    items: [],
    lessons: [],
    mockMinutes: 0,
    ...(mockMisses && { mockMisses }),
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: toIsoDate(TODAY) }),
    today: TODAY,
  };
}

function topicOrder(input: BuildPlanInput): string[] {
  const first = new Map<string, number>();

  buildPlan(input)
    .items.filter((item) => item.kind === "lesson" && item.skillId)
    .forEach((item) => {
      const at = item.scheduledFor?.getTime() ?? Infinity;
      const skillId = item.skillId ?? "";
      first.set(skillId, Math.min(at, first.get(skillId) ?? Infinity));
    });

  return [...first].toSorted(([, a], [, b]) => a - b).map(([skillId]) => skillId);
}

type BuiltPlan = ReturnType<typeof buildPlan>;

function savePlan(input: BuildPlanInput): ExistingPlanItem[] {
  return buildPlan(input).items.map((item, position) => ({
    ...item,
    id: item.id ?? `saved-${position}`,
    position,
  }));
}

function lessonsOf(plan: BuiltPlan) {
  return plan.items.filter((item) => item.kind === "lesson");
}

function lessonKeys(plan: BuiltPlan): Set<string> {
  return new Set(lessonsOf(plan).map(({ key }) => key));
}

function firstLessonAt({ plan, skillId }: { plan: BuiltPlan; skillId: string }): number {
  return Math.min(
    ...lessonsOf(plan).flatMap((item) =>
      item.skillId === skillId && item.scheduledFor ? [item.scheduledFor.getTime()] : [],
    ),
  );
}

function studyDays(plan: BuiltPlan): number[] {
  const days = lessonsOf(plan).flatMap((item) =>
    item.status === "todo" && item.scheduledFor && item.scheduledFor > TODAY
      ? [item.scheduledFor.getTime()]
      : [],
  );

  return [...new Set(days)].toSorted((a, b) => a - b);
}

function countBehind({ input, plan }: { input: BuildPlanInput; plan: BuiltPlan }): number {
  const carried = new Set(input.items.map((item) => item.id));

  const behind = lessonsOf(plan).filter(
    ({ id, status }) => id && carried.has(id) && status === "todo",
  );

  return behind.length;
}

function bySkill<TEntry extends { skillId: string }>(entries: readonly TEntry[]) {
  return entries.toSorted((a, b) => a.skillId.localeCompare(b.skillId));
}

/** A mock only reorders: the same work is kept and left out, and nothing the learner sees moves. */
function expectOnlyReordered({
  input,
  missed,
}: {
  input: BuildPlanInput;
  missed: readonly string[];
}) {
  const withMock = { ...input, mockMisses: new Map(missed.map((id) => [id, "missed"] as const)) };
  const baseline = buildPlan(input);
  const reordered = buildPlan(withMock);
  const before = getPlanFeasibility({ input, planned: baseline });
  const after = getPlanFeasibility({ input: withMock, planned: reordered });

  expect(lessonKeys(reordered)).toStrictEqual(lessonKeys(baseline));
  expect(reordered.droppedSkillIds.toSorted()).toStrictEqual(baseline.droppedSkillIds.toSorted());
  expect(bySkill(reordered.skillMinutes)).toStrictEqual(bySkill(baseline.skillMinutes));
  expect(countBehind({ input, plan: reordered })).toBe(countBehind({ input, plan: baseline }));

  expect(reordered.phases.map(({ endDate }) => endDate)).toStrictEqual(
    baseline.phases.map(({ endDate }) => endDate),
  );

  expect(after.coreFits).toBe(before.coreFits);
  expect(after.coveredShare).toBeCloseTo(before.coveredShare, 9);

  expect(
    findPlanSuggestion({ dailyMinutes: input.goal.dailyMinutes, feasibility: after }),
  ).toStrictEqual(
    findPlanSuggestion({ dailyMinutes: input.goal.dailyMinutes, feasibility: before }),
  );

  expect(
    holdsSchedule({
      baseline: {
        built: baseline,
        feasibility: before,
        selected: summarizeSelectedPlan({ built: baseline, examSubjects: null, input }),
      },
      computed: {
        built: reordered,
        feasibility: after,
        selected: summarizeSelectedPlan({ built: reordered, examSubjects: null, input: withMock }),
      },
      movableFrom: addDays(TODAY, 1),
    }),
  ).toBe(true);

  return { baseline, reordered };
}

describe("an exam plan after a mock", () => {
  it("teaches the topics the mock missed before the others of the same weight", () => {
    expect(topicOrder(examInput())).toStrictEqual(TOPICS);

    expect(topicOrder(examInput(new Map([["percentages", "missed"]])))).toStrictEqual([
      "percentages",
      "fractions",
      "ratios",
      "equations",
    ]);
  });

  it.each([
    { expected: ["ratios", "percentages", "equations", "fractions"], shared: false },
    { expected: ["fractions", "ratios", "percentages", "equations"], shared: true },
  ])(
    "keeps a missed undated exam topic after its prerequisite (shared lessons: $shared)",
    ({ expected, shared }) => {
      const input = examInput();
      const order = ["equations", "fractions", "ratios", "percentages"];
      const sharedSkills = ["fractions", "ratios"];

      const course = {
        ...input,
        goal: { ...input.goal, targetDate: null },
        graph: {
          ...input.graph,
          skills: input.graph.skills.map((skill) => ({ ...skill, lessons: 1 })),
        },
        lessons: order.map((skillId, position) => {
          const inRun = shared && sharedSkills.includes(skillId);

          return {
            chapterId: inRun ? "shared" : skillId,
            courseOrder: { phase: 0, position },
            lessonId: skillId,
            minutes: 3,
            skillIds: inRun ? sharedSkills : [skillId],
            title: skillId,
          };
        }),
        prerequisites: new Map([["percentages", ["ratios"]]]),
      } satisfies BuildPlanInput;

      const { baseline, reordered } = expectOnlyReordered({
        input: course,
        missed: ["percentages"],
      });

      expect(lessonsOf(baseline).map(({ lessonId }) => lessonId)).toStrictEqual(order);
      expect(lessonsOf(reordered).map(({ lessonId }) => lessonId)).toStrictEqual(expected);
    },
  );

  it("puts a miss in a part under its minimum before any other miss", () => {
    const misses = new Map<string, MockMiss>([
      ["ratios", "missed"],
      ["equations", "shortPart"],
    ]);

    expect(topicOrder(examInput(misses)).slice(0, 2)).toStrictEqual(["equations", "ratios"]);
  });

  it("puts a missed topic ahead of an unmissed heavier topic in the same phase", () => {
    const input = examInput(new Map([["equations", "missed"]]));

    const weighted = {
      ...input,
      graph: {
        ...input.graph,
        skills: input.graph.skills.map((skill) => ({
          ...skill,
          weight: skill.skillId === "fractions" ? 5 : skill.weight,
        })),
      },
    };

    expect(topicOrder(weighted).slice(0, 2)).toStrictEqual(["equations", "fractions"]);
  });

  it("moves kept mock misses earlier without changing what fits in a short exam plan", () => {
    const original = examInput();

    const skills = Array.from({ length: 12 }, (_, index) => ({
      area: index < 6 ? "Math" : "Language",
      lessons: 5,
      name: `Topic ${index}`,
      phase: 0,
      skillId: `topic-${index}`,
      weight: 3,
    }));

    const lessons = skills.flatMap(({ skillId, lessons: count }) =>
      Array.from({ length: count }, (_, index) => ({
        chapterId: skillId,
        lessonId: `${skillId}-lesson-${index}`,
        minutes: 4,
        skillIds: [skillId],
        title: `${skillId} lesson ${index}`,
      })),
    );

    const carried = lessons[0]!;

    const input = {
      ...original,
      carryOver: { itemIds: ["carried"], lessonIds: [carried.lessonId] },
      goal: { ...original.goal, dailyMinutes: 15, targetDate: addDays(TODAY, 18) },
      graph: { ...original.graph, skills },
      items: [
        {
          chapterId: carried.chapterId,
          completedAt: null,
          id: "carried",
          kind: "lesson",
          lessonId: carried.lessonId,
          phase: 0,
          position: 0,
          scheduledFor: addDays(TODAY, -1),
          skillId: carried.skillIds[0]!,
          status: "todo",
          titleSnapshot: carried.title,
        },
      ],
      lessons,
      openedKeys: [],
      todayShown: true,
    } satisfies BuildPlanInput;

    const keptMisses = ["topic-2", "topic-3", "topic-8", "topic-9"];

    const { baseline, reordered } = expectOnlyReordered({
      input,
      missed: [...keptMisses, "topic-10"],
    });

    expect(baseline.droppedSkillIds).toContain("topic-10");
    expect(countBehind({ input, plan: reordered })).toBe(1);

    for (const skillId of keptMisses) {
      expect(firstLessonAt({ plan: reordered, skillId })).toBeLessThan(
        firstLessonAt({ plan: baseline, skillId }),
      );
    }
  });

  it("leads the next study day with kept misses in a plan whose core doesn't fit", () => {
    const input = examInput();
    const areas = ["Math", "Languages", "Science", "Humanities", "Writing"];

    const skills = Array.from({ length: 200 }, (_, index) => ({
      area: areas[index % areas.length]!,
      lessons: 8,
      name: `Topic ${index}`,
      phase: 0,
      skillId: `topic-${index}`,
      weight: 2 + (index % 5),
    }));

    const unsaved = {
      ...input,
      goal: { ...input.goal, dailyMinutes: 37, targetDate: addDays(TODAY, 150) },
      graph: { ...input.graph, skills },
      openedKeys: [],
      todayShown: true,
    } satisfies BuildPlanInput;

    const exam = { ...unsaved, items: savePlan(unsaved) };
    const missed = ["topic-197", "topic-198"];
    const { baseline, reordered } = expectOnlyReordered({ input: exam, missed });

    expect(getPlanFeasibility({ input: exam, planned: baseline }).coreFits).toBe(false);

    const [nextDay] = studyDays(reordered);

    for (const skillId of missed) {
      expect(firstLessonAt({ plan: baseline, skillId })).toBeGreaterThan(nextDay!);
      expect(firstLessonAt({ plan: reordered, skillId })).toBe(nextDay);
    }
  });

  it("leads the next study day with an available mock miss across exam subjects", () => {
    const input = examInput();
    const missed = "word-choice";

    const skills = [
      { area: "Math", skillId: "percentages", weight: 8 },
      { area: "Science", skillId: "food-chains", weight: 7 },
      { area: "Writing", skillId: "competencies", weight: 6 },
      { area: "Languages", skillId: "interpretation", weight: 3 },
      { area: "Languages", skillId: missed, weight: 3 },
      { area: "Languages", skillId: "register", weight: 2 },
      { area: "Languages", skillId: "genre", weight: 5 },
    ];

    const exam = {
      ...input,
      goal: { ...input.goal, dailyMinutes: 45 },
      graph: {
        ...input.graph,
        skills: skills.map((skill) => ({ ...skill, lessons: 3, name: skill.skillId, phase: 0 })),
      },
      openedKeys: [],
      prerequisites: new Map([["genre", ["register"]]]),
      settings: parsePlanSettings({ reducedAreas: ["Languages"], startDate: toIsoDate(TODAY) }),
      todayShown: true,
    } satisfies BuildPlanInput;

    const baseline = buildPlan(exam);

    const applied = buildPlan({
      ...exam,
      mockMisses: new Map([
        [missed, "missed"],
        ["register", "missed"],
        ["genre", "missed"],
      ]),
    });

    const lessonOf = (plan: typeof baseline, skillId: string) =>
      plan.items.find((item) => item.kind === "lesson" && item.skillId === skillId);

    expect(lessonOf(baseline, missed)?.scheduledFor).toBeDefined();
    expect(lessonOf(applied, missed)?.scheduledFor).toStrictEqual(addDays(TODAY, 1));

    expect(applied.items.indexOf(lessonOf(applied, missed)!)).toBeLessThan(
      applied.items.indexOf(lessonOf(applied, "interpretation")!),
    );

    expect(applied.items.indexOf(lessonOf(applied, "register")!)).toBeLessThan(
      applied.items.indexOf(lessonOf(applied, "genre")!),
    );

    expect(applied.droppedSkillIds).toStrictEqual(baseline.droppedSkillIds);

    expect(applied.phases.map(({ endDate }) => endDate)).toStrictEqual(
      baseline.phases.map(({ endDate }) => endDate),
    );

    const skipped = buildPlan({
      ...exam,
      mockMisses: new Map([[missed, "missed"]]),
      settings: { ...exam.settings, skippedAreas: ["Languages"] },
    });

    expect(lessonOf(skipped, missed)).toBeUndefined();

    const nextMock = buildPlan({ ...exam, mockMisses: new Map([["food-chains", "missed"]]) });

    expect(nextMock.items.indexOf(lessonOf(nextMock, "food-chains")!)).toBeLessThan(
      nextMock.items.indexOf(lessonOf(nextMock, missed)!),
    );
  });
});

describe(getExamValue, () => {
  it("leaves a topic the learner already recalls to what memory says of it", () => {
    const readiness = {
      reps: 3,
      retrievabilityAtTarget: 0.5,
      stability: 4,
      state: "learning" as const,
    };

    expect(getExamValue({ mockMiss: "shortPart", readiness, weight: 3 })).toBe(
      getExamValue({ readiness, weight: 3 }),
    );
  });
});
