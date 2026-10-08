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
    missedSkillIds: new Set(["rewrite"]),
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

/** The subjects of a day in the order its blocks come, one entry per block. */
function runsOf(items: readonly PlannedItem[]): string[] {
  const areas = items.map((item) => areaOf(item) ?? "");
  return areas.filter((area, index) => index === 0 || areas[index - 1] !== area);
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

  it("keeps a skill placement found known out of the plan when more of its lessons are outlined", () => {
    // Placement found law known while only its first chapter was outlined: those lessons were
    // tested out. The chapters outlined since teach the same skill.
    const testedOutLaw = Array.from({ length: 6 }, (_, index) => ({
      ...TESTED_OUT_STAND_IN,
      id: `law-item-${index}`,
      lessonId: `law-${index}`,
      position: index + 1,
      skillId: "law",
      titleSnapshot: `Read the constitution ${index + 1}`,
    }));

    const plan = buildPlan(examInput({ items: [TESTED_OUT_STAND_IN, ...testedOutLaw] }));
    const todo = plan.items.filter((item) => item.status === "todo" && item.kind === "lesson");

    expect(todo.some((item) => item.skillId === "law")).toBe(false);
    expect(todo.some((item) => item.skillId === "logic")).toBe(true);
  });

  it("brings back a lesson that also teaches a skill the learner doesn't know yet", () => {
    const testedOutLaw = {
      ...TESTED_OUT_STAND_IN,
      id: "law-item",
      lessonId: "law-0",
      skillId: "law",
      titleSnapshot: "Read the constitution 1",
    };

    const shared: PlannerLesson = {
      chapterId: "law-logic",
      lessonId: "law-logic",
      minutes: 3,
      skillIds: ["law", "logic"],
      title: "Propositions in the constitution",
    };

    const plan = buildPlan(
      examInput({ items: [TESTED_OUT_STAND_IN, testedOutLaw], lessons: [...LESSONS, shared] }),
    );

    expect(plan.items.some((item) => item.lessonId === "law-logic" && item.status === "todo")).toBe(
      true,
    );
  });

  it("opens with the gap placement found and rotates a couple of subjects a day by their worth", () => {
    const plan = buildPlan(examInput());
    const dayOne = lessonsOn({ date: "2026-09-28", items: plan.items });

    // An hour a day studies two subjects, in a block each, starting with the gap placement found.
    expect(dayOne[0]?.skillId).toBe("rewrite");
    expect(runsOf(dayOne)).toStrictEqual(["Portuguese", "Logic"]);

    const twoDays = ["2026-09-28", "2026-09-29"].flatMap((date) =>
      lessonsOn({ date, items: plan.items }),
    );

    expect(new Set(twoDays.map((item) => areaOf(item)))).toStrictEqual(
      new Set(["Portuguese", "Logic", "Law", "Fitness"]),
    );

    const studyDays = [...new Set(plan.items.map((item) => item.scheduledFor?.getTime()))];

    const days = studyDays.map((time) =>
      lessonsOn({ date: toIsoDate(new Date(time ?? 0)), items: plan.items }),
    );

    expect(days.every((day) => runsOf(day).length <= 2)).toBe(true);

    const firstWeek = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"];

    const byArea = minutesByArea(
      firstWeek.flatMap((date) => lessonsOn({ date, items: plan.items })),
    );

    // Fitness is worth the least, so it comes back least often.
    expect(Math.min(byArea.Portuguese ?? 0, byArea.Logic ?? 0, byArea.Law ?? 0)).toBeGreaterThan(
      byArea.Fitness ?? 0,
    );

    const rewriteStart = plan.items.findIndex((item) => item.skillId === "rewrite");
    const readingStart = plan.items.findIndex((item) => item.skillId === "reading");

    expect(rewriteStart).toBeLessThan(readingStart);
  });

  it("keeps the day's mix of subjects while the others' lessons aren't outlined yet", () => {
    const portuguese = LESSONS.filter((lesson) =>
      lesson.skillIds.every((skillId) => !["logic", "law", "fitness"].includes(skillId)),
    );

    const plan = buildPlan(examInput({ lessons: portuguese }));
    const dayOne = lessonsOn({ date: "2026-09-28", items: plan.items });

    // The other subjects' stand-ins share the day with Portuguese instead of waiting for a day
    // they fit whole, so the cycle doesn't open with Portuguese alone.
    expect(runsOf(dayOne)).toStrictEqual(["Portuguese", "Logic"]);

    const twoDays = ["2026-09-28", "2026-09-29"].flatMap((date) =>
      lessonsOn({ date, items: plan.items }),
    );

    expect(new Set(twoDays.map((item) => areaOf(item)))).toStrictEqual(
      new Set(["Portuguese", "Logic", "Law", "Fitness"]),
    );

    // Each stand-in stays one item, on the day its skill starts, with its whole skill's time.
    const logic = plan.items.filter((item) => item.skillId === "logic");

    expect(logic).toHaveLength(1);
    expect(logic[0]?.scheduledFor && toIsoDate(logic[0].scheduledFor)).toBe("2026-09-28");
    expect(logic[0]?.minutes).toBeGreaterThanOrEqual(24 * 3);
  });

  it("rotates subjects inside each phase when the exam has no date yet", () => {
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
