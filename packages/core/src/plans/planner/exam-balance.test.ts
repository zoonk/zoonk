import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { weighGraphByCourse } from "./course-weights";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";

/** A Wednesday, about two weeks before an ENEM-like exam: too little time for everything. */
const TODAY = fromIsoDate("2026-10-07");
const AREAS = ["Linguagens", "Humanas", "Natureza", "Matemática"] as const;
const SKILLS_PER_AREA = 12;
const LESSONS_PER_SKILL = 9;

type Area = (typeof AREAS)[number] | "Redação";

function skillId(area: Area, index: number): string {
  return `${area}-${index}`;
}

function lessonsOf({
  chapter,
  count,
  skillIds,
}: {
  chapter: string;
  count: number;
  skillIds: string[];
}) {
  return Array.from({ length: count }, (_, index): PlannerLesson => ({
    chapterId: chapter,
    lessonId: `${chapter}-${index}`,
    minutes: 3,
    skillIds,
    title: `${chapter} ${index + 1}`,
  }));
}

/**
 * Four areas of chained skills, each skill building on the one before it, and a redação of five
 * outcome skills, all worth the same. In each area a chapter shared by its second and sixth skills
 * is planned where the second is taught while its later lessons count for the sixth, which builds
 * on the third to fifth: the order that left Lucas's areas waiting on their own later lessons.
 */
function enemPlan(focusAreas: string[] = []): BuildPlanInput {
  const areaSkills = AREAS.flatMap((area) =>
    Array.from({ length: SKILLS_PER_AREA }, (_, index): PlanGraphSkill => ({
      area,
      lessons: LESSONS_PER_SKILL,
      name: skillId(area, index),
      phase: 0,
      skillId: skillId(area, index),
      weight: 3,
    })),
  );

  const essaySkills = Array.from({ length: 5 }, (_, index): PlanGraphSkill => ({
    area: "Redação",
    lessons: 20,
    name: skillId("Redação", index),
    outcome: true,
    phase: 0,
    skillId: skillId("Redação", index),
    weight: 3,
  }));

  const lessons = [
    ...AREAS.flatMap((area) =>
      Array.from({ length: SKILLS_PER_AREA }, (_, index) => {
        if (index === 1 || index === 5) {
          return [];
        }

        return lessonsOf({
          chapter: skillId(area, index),
          count: LESSONS_PER_SKILL,
          skillIds: [skillId(area, index)],
        });
      }).flat(),
    ),
    ...AREAS.flatMap((area) =>
      lessonsOf({
        chapter: `${area}-shared`,
        count: LESSONS_PER_SKILL * 2,
        skillIds: [skillId(area, 1), skillId(area, 5)],
      }),
    ),
    ...essaySkills.flatMap((skill) =>
      lessonsOf({ chapter: skill.skillId, count: 20, skillIds: [skill.skillId] }),
    ),
  ];

  const prerequisites = new Map(
    [...AREAS, "Redação" as const].flatMap((area) =>
      Array.from({ length: area === "Redação" ? 5 : SKILLS_PER_AREA }, (_, index) =>
        index === 0 ? [] : [[skillId(area, index), [skillId(area, index - 1)]] as const],
      ).flat(),
    ),
  );

  return {
    goal: { dailyMinutes: 180, kind: "exam", targetDate: addDays(TODAY, 16) },
    graph: {
      phases: [{ milestone: null, name: "Preparação" }],
      skills: [...areaSkills, ...essaySkills],
    },
    items: [],
    lessons,
    mockMinutes: 330,
    mode: "forced",
    paceFactor: 1,
    prerequisites,
    readiness: new Map(),
    settings: parsePlanSettings({ focusAreas, startDate: toIsoDate(TODAY) }),
    today: TODAY,
  };
}

/** Each area's share of the lesson minutes on the plan's first `days` days. */
function sharesOfFirstDays({ days, input }: { days: number; input: BuildPlanInput }) {
  const last = addDays(TODAY, days - 1).getTime();
  const areaOf = new Map(input.graph.skills.map((skill) => [skill.skillId, skill.area ?? ""]));

  const minutes = buildPlan(input)
    .items.filter(
      (item) =>
        item.kind === "lesson" &&
        item.skillId &&
        item.scheduledFor &&
        item.scheduledFor.getTime() <= last,
    )
    .reduce((areas, item) => {
      const area = areaOf.get(item.skillId ?? "") ?? "";
      return areas.set(area, (areas.get(area) ?? 0) + (item.minutes ?? 0));
    }, new Map<string, number>());

  const total = [...minutes.values()].reduce((sum, value) => sum + value, 0);

  return new Map([...minutes].map(([area, value]) => [area, value / total]));
}

describe("an ENEM-like plan short on time", () => {
  it("studies every area in its first week, each in proportion to what it's worth", () => {
    const shares = sharesOfFirstDays({ days: 7, input: enemPlan() });

    // Five parts worth the same: each gets about a fifth, the redação included, never most of it.
    [...AREAS, "Redação"].forEach((area) => {
      expect(shares.get(area) ?? 0).toBeGreaterThan(0.12);
      expect(shares.get(area) ?? 0).toBeLessThan(0.3);
    });
  });

  it("gives an area the learner focuses on a bigger share of the plan", () => {
    // Every core comes first, so the focus shows once the cores are placed: in the depth after them.
    const unfocused = sharesOfFirstDays({ days: 16, input: enemPlan() });
    const focused = sharesOfFirstDays({ days: 16, input: enemPlan(["Natureza"]) });

    expect(focused.get("Natureza") ?? 0).toBeGreaterThan((unfocused.get("Natureza") ?? 0) + 0.05);
    expect(focused.get("Redação") ?? 0).toBeGreaterThan(0.08);
  });

  it("keeps every topic's core, the redação's included, without keeping its whole depth", () => {
    const plan = buildPlan(enemPlan());

    expect(plan.waitingSkillIds).toStrictEqual([]);

    const essayLessons = plan.items.filter(
      (item) => item.kind === "lesson" && item.skillId?.startsWith("Redação"),
    );

    // Each redação skill keeps at least its first third; not all 100 of its lessons crowd the rest out.
    expect(essayLessons.length).toBeGreaterThanOrEqual(5 * 7);
    expect(essayLessons.length).toBeLessThan(100);
  });

  it("gives the parts the learner's course counts more a bigger share of the plan", () => {
    const input = enemPlan();

    // Medicina at a university that counts Natureza and the redação twice.
    const weights = {
      course: "Medicina",
      edition: null,
      institution: "UFMG",
      source: null,
      status: "found" as const,
      subjects: [
        { name: "Linguagens", weight: 1 },
        { name: "Humanas", weight: 1 },
        { name: "Natureza", weight: 2 },
        { name: "Matemática", weight: 1 },
        { name: "Redação", weight: 2 },
      ],
    };

    const even = sharesOfFirstDays({ days: 16, input });

    const weighted = sharesOfFirstDays({
      days: 16,
      input: { ...input, graph: weighGraphByCourse({ graph: input.graph, weights }) },
    });

    expect(weighted.get("Natureza") ?? 0).toBeGreaterThan((even.get("Natureza") ?? 0) + 0.03);
    expect(weighted.get("Redação") ?? 0).toBeGreaterThan(even.get("Redação") ?? 0);
    expect(weighted.get("Humanas") ?? 0).toBeLessThan(even.get("Humanas") ?? 0);
  });
});

/** Each study day's share of lesson minutes on the written test, in the plan's order. */
function writtenShareByDay(input: BuildPlanInput): number[] {
  const areaOf = new Map(input.graph.skills.map((skill) => [skill.skillId, skill.area ?? ""]));

  const lessons = buildPlan(input).items.filter(
    (item) => item.kind === "lesson" && item.scheduledFor,
  );

  const days = Map.groupBy(lessons, (item) => item.scheduledFor?.getTime() ?? 0);

  return [...days]
    .toSorted(([a], [b]) => a - b)
    .map(([, items]) => {
      const total = items.reduce((sum, item) => sum + (item.minutes ?? 0), 0);

      const written = items
        .filter((item) => areaOf.get(item.skillId ?? "") === "Redação")
        .reduce((sum, item) => sum + (item.minutes ?? 0), 0);

      return total > 0 ? written / total : 0;
    });
}

describe("an exam's written test", () => {
  it("shares the last days with the other parts instead of taking them alone", () => {
    const input = enemPlan();

    // An hour a day for two weeks fits few cores: kept whole, the redação's took the last days.
    const shares = writtenShareByDay({ ...input, goal: { ...input.goal, dailyMinutes: 60 } });

    expect(shares.slice(-3).every((share) => share < 0.6)).toBe(true);
  });

  it("keeps a written test in the first week at a protected share when the learner writes well", () => {
    // Time for everything: nothing is cut, so only what each part is worth orders the weeks.
    const input = enemPlan();

    // The learner writes well already: little gap on the redação, so little worth on its own.
    const strong = {
      reps: 6,
      retrievabilityAtTarget: 0.97,
      stability: 60,
      state: "mastered" as const,
    };

    const readiness = new Map(
      input.graph.skills
        .filter((graphSkill) => graphSkill.outcome)
        .map((graphSkill) => [graphSkill.skillId, strong]),
    );

    const shares = sharesOfFirstDays({
      days: 7,
      input: { ...input, goal: { ...input.goal, targetDate: addDays(TODAY, 45) }, readiness },
    });

    // Graded writing improves only with practice spread over the weeks: at least half an
    // average part's time, never left for the end.
    expect(shares.get("Redação") ?? 0).toBeGreaterThan(0.08);
  });

  it("starts a written test that builds on later topics in the plan's first week", () => {
    const input = enemPlan();

    const graph = {
      phases: [
        { milestone: null, name: "Base" },
        { milestone: null, name: "Escrita" },
      ],
      skills: input.graph.skills.map((graphSkill) =>
        graphSkill.outcome ? { ...graphSkill, phase: 1 } : graphSkill,
      ),
    };

    const shares = sharesOfFirstDays({
      days: 7,
      input: { ...input, goal: { ...input.goal, targetDate: addDays(TODAY, 90) }, graph },
    });

    expect(shares.get("Redação") ?? 0).toBeGreaterThan(0.1);
  });
});
