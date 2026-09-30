import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { type ExistingPlanItem, type PlannedItem } from "./plan-items";
import { type PlanGraphSkill, parsePlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";
import { type SkillReadiness } from "./skill-order";

/** A Monday, six weeks before the exam. */
const TODAY = fromIsoDate("2026-09-28");
const EXAM_DAY = fromIsoDate("2026-11-08");

/**
 * An adult's public-service exam: Portuguese (a school foundation the exam doesn't ask on its own,
 * then reading and rewriting at the exam's depth), logic, law and a small fitness area.
 */
const SKILLS: PlanGraphSkill[] = [
  {
    area: "Portuguese",
    lessons: 12,
    name: "Word classes",
    phase: 0,
    skillId: "classes",
    weight: 1,
  },
  { area: "Portuguese", lessons: 24, name: "Read texts", phase: 0, skillId: "reading", weight: 5 },
  {
    area: "Portuguese",
    lessons: 24,
    name: "Judge rewrites",
    phase: 0,
    skillId: "rewrite",
    weight: 5,
  },
  {
    area: "Logic",
    lessons: 24,
    name: "Evaluate propositions",
    phase: 0,
    skillId: "logic",
    weight: 4,
  },
  { area: "Law", lessons: 24, name: "Read the constitution", phase: 0, skillId: "law", weight: 3 },
  { area: "Fitness", lessons: 12, name: "Plan training", phase: 0, skillId: "fitness", weight: 1 },
];

/** Every skill is outlined by now: its chapter's lessons, six to a chapter. */
const LESSONS: PlannerLesson[] = SKILLS.flatMap((skill) =>
  Array.from({ length: skill.lessons }, (_, index) => ({
    chapterId: `${skill.skillId}-${Math.floor(index / 6)}`,
    lessonId: `${skill.skillId}-${index}`,
    minutes: 3,
    skillIds: [skill.skillId],
    title: `${skill.name} ${index + 1}`,
  })),
);

/**
 * Placement answered while the plan still had one stand-in per skill: word classes are known (their
 * stand-in was tested out before the chapter was outlined), rewriting is a gap (a wrong first
 * answer), and reading was answered right once.
 */
const TESTED_OUT_STAND_IN: ExistingPlanItem = {
  chapterId: null,
  completedAt: TODAY,
  id: "stand-in",
  kind: "lesson",
  lessonId: null,
  phase: 0,
  position: 0,
  scheduledFor: TODAY,
  skillId: "classes",
  status: "testedOut",
  titleSnapshot: "Word classes",
};

const READINESS = new Map<string, SkillReadiness>([
  ["rewrite", { reps: 1, retrievabilityAtTarget: 0.45, stability: 0.2, state: "learning" }],
  ["reading", { reps: 1, retrievabilityAtTarget: 0.64, stability: 2.3, state: "learning" }],
]);

function examInput(attrs: Partial<BuildPlanInput> = {}): BuildPlanInput {
  return {
    goal: { dailyMinutes: 60, kind: "exam", targetDate: EXAM_DAY },
    graph: { phases: [{ milestone: null, name: "Everything" }], skills: SKILLS },
    items: [TESTED_OUT_STAND_IN],
    lessons: LESSONS,
    mockMinutes: 150,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map([["rewrite", ["classes"]]]),
    readiness: READINESS,
    settings: parsePlanSettings({ startDate: "2026-09-28" }),
    today: TODAY,
    ...attrs,
  };
}

function lessonsOn({ date, items }: { date: string; items: readonly PlannedItem[] }) {
  return items.filter(
    (item) =>
      item.kind === "lesson" &&
      item.status === "todo" &&
      item.scheduledFor &&
      toIsoDate(item.scheduledFor) === date,
  );
}

function areaOf(item: PlannedItem): string | undefined {
  return SKILLS.find((skill) => skill.skillId === item.skillId)?.area ?? undefined;
}

function minutesByArea(items: readonly PlannedItem[]): Record<string, number> {
  const areas = [...new Set(items.map((item) => areaOf(item) ?? ""))];

  return Object.fromEntries(
    areas.map((area) => [
      area,
      items
        .filter((item) => (areaOf(item) ?? "") === area)
        .reduce((total, item) => total + item.minutes, 0),
    ]),
  );
}

describe("an adult's exam plan after placement", () => {
  it("keeps a foundation placement tested out out of the plan once its chapter is outlined", () => {
    const plan = buildPlan(examInput());
    const todo = plan.items.filter((item) => item.status === "todo" && item.kind === "lesson");

    expect(todo.some((item) => item.skillId === "classes")).toBe(false);
    expect(plan.items.find((item) => item.id === "stand-in")?.status).toBe("testedOut");
  });

  it("opens with the gap placement found and mixes the exam's areas by weight from day 1", () => {
    const plan = buildPlan(examInput());
    const dayOne = lessonsOn({ date: "2026-09-28", items: plan.items });

    expect(dayOne[0]?.skillId).toBe("rewrite");
    expect(new Set(dayOne.map((item) => areaOf(item))).size).toBeGreaterThanOrEqual(2);

    const firstWeek = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"];
    const weekLessons = firstWeek.flatMap((date) => lessonsOn({ date, items: plan.items }));
    const byArea = minutesByArea(weekLessons);

    expect(byArea.Portuguese).toBeGreaterThan(byArea.Logic ?? 0);
    expect(byArea.Logic).toBeGreaterThan(byArea.Law ?? 0);
    expect(byArea.Law).toBeGreaterThan(byArea.Fitness ?? 0);

    const rewriteStart = plan.items.findIndex((item) => item.skillId === "rewrite");
    const readingStart = plan.items.findIndex((item) => item.skillId === "reading");

    expect(rewriteStart).toBeLessThan(readingStart);
  });

  it("mixes areas inside each phase when the exam has no date yet", () => {
    const plan = buildPlan(
      examInput({
        goal: { dailyMinutes: 60, kind: "exam", targetDate: null },
        readiness: new Map(),
      }),
    );

    const dayOne = lessonsOn({ date: "2026-09-28", items: plan.items });

    expect(new Set(dayOne.map((item) => areaOf(item))).size).toBeGreaterThanOrEqual(2);
    expect(dayOne.every((item) => item.skillId !== "classes")).toBe(true);
    expect(plan.items.filter((item) => item.kind === "boss")).toHaveLength(1);
  });
});
