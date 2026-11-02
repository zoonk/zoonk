import { once } from "@zoonk/utils/once";
import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { addDays, daysBetween, fromIsoDate, getStartOfWeek, toIsoDate } from "./plan-calendar";
import { type PlanGraphSkill, type WrittenCadence, parsePlanSettings } from "./plan-state";
import { type PlannerLesson } from "./plan-units";
import { getFinalWeeksStart, isWrittenDay } from "./written-cadence";

const TODAY = fromIsoDate("2026-10-07");
const SKILLS_PER_AREA = 10;
const WRITTEN_SKILLS = 5;
const WRITTEN_LESSONS = 12;

function skillsOf({
  area,
  count,
  lessons,
  outcome,
}: {
  area: string;
  count: number;
  lessons: number;
  outcome: boolean;
}) {
  return Array.from({ length: count }, (_, index): PlanGraphSkill => ({
    area,
    lessons: outcome ? WRITTEN_LESSONS : lessons,
    name: `${area} ${index + 1}`,
    phase: 0,
    skillId: `${area}-${index}`,
    weight: 3,
    ...(outcome && { outcome: true }),
  }));
}

function lessonsOf(skill: PlanGraphSkill): PlannerLesson[] {
  return Array.from({ length: skill.lessons }, (_, index) => ({
    chapterId: skill.skillId,
    lessonId: `${skill.skillId}-${index}`,
    minutes: 3,
    skillIds: [skill.skillId],
    title: `${skill.name}, lesson ${index + 1}`,
  }));
}

function examPlan({
  areas,
  cadence = "weekly",
  dailyMinutes,
  days,
  lessons,
  written,
}: {
  areas: readonly string[];
  cadence?: WrittenCadence;
  dailyMinutes: number;
  days: number;
  lessons: number;
  written: readonly string[];
}): BuildPlanInput {
  const skills = [
    ...areas.flatMap((area) => skillsOf({ area, count: SKILLS_PER_AREA, lessons, outcome: false })),
    ...written.flatMap((area) => skillsOf({ area, count: WRITTEN_SKILLS, lessons, outcome: true })),
  ];

  const prerequisites = new Map(
    skills.flatMap((skill) => {
      const index = Number(skill.skillId.split("-").at(-1));
      return index === 0 ? [] : [[skill.skillId, [`${skill.area}-${index - 1}`]] as const];
    }),
  );

  return {
    goal: { dailyMinutes, kind: "exam", targetDate: addDays(TODAY, days) },
    graph: { phases: [{ milestone: null, name: "Preparação" }], skills },
    items: [],
    lessons: skills.flatMap((skill) => lessonsOf(skill)),
    mockMinutes: 330,
    mode: "forced",
    paceFactor: 1,
    prerequisites,
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: toIsoDate(TODAY), writtenCadence: cadence }),
    today: TODAY,
  };
}

function lucas(cadence?: WrittenCadence) {
  return examPlan({
    areas: ["Linguagens", "Humanas", "Natureza", "Matemática"],
    cadence,
    dailyMinutes: 180,
    days: 32,
    lessons: 20,
    written: ["Redação"],
  });
}

function rafaela(cadence?: WrittenCadence) {
  return examPlan({
    areas: ["Português", "Direito", "Processo Legislativo", "Ciência Política", "Inglês", "TI"],
    cadence,
    dailyMinutes: 120,
    days: 102,
    lessons: 20,
    written: ["Discursiva", "Peça"],
  });
}

function planLessons(input: BuildPlanInput) {
  const writtenSkills = new Set(
    input.graph.skills.filter((skill) => skill.outcome).map((skill) => skill.skillId),
  );

  const lessons = buildPlan(input).items.filter(
    (item) => item.kind === "lesson" && item.scheduledFor && item.lessonId,
  );

  return { lessons, written: lessons.filter((item) => writtenSkills.has(item.skillId ?? "")) };
}

function writtenLessons(input: BuildPlanInput) {
  return planLessons(input).written;
}

const lucasWeekly = once(() => planLessons(lucas()));

function weeksOf(items: readonly { scheduledFor: Date | null }[]): Set<number> {
  const firstMonday = getStartOfWeek(TODAY);

  return new Set(
    items.map((item) => Math.floor(daysBetween(firstMonday, item.scheduledFor ?? TODAY) / 7)),
  );
}

function firstDay(items: readonly { scheduledFor: Date | null }[]): number {
  return Math.min(...items.map((item) => (item.scheduledFor ?? TODAY).getTime()));
}

describe("when an exam's written tests are practiced", () => {
  it("practices them from the plan's first days by default, over every week the plan has lessons", () => {
    const { lessons, written } = lucasWeekly();
    const lastLessonWeek = Math.max(...weeksOf(lessons));

    expect(firstDay(written)).toBeLessThanOrEqual(addDays(TODAY, 1).getTime());

    expect([...weeksOf(written)].toSorted((a, b) => a - b)).toStrictEqual(
      Array.from({ length: lastLessonWeek + 1 }, (_, week) => week),
    );
  });

  it("practices them every other week with the same lessons as every week", () => {
    const weekly = lucasWeekly().written;
    const biweekly = writtenLessons(lucas("biweekly"));

    expect([...weeksOf(biweekly)].toSorted((a, b) => a - b)).toStrictEqual([0, 2, 4]);
    expect(biweekly).toHaveLength(weekly.length);
  });

  it("practices them only in the final weeks with the same lessons as every week", () => {
    const weekly = lucasWeekly().written;
    const final = writtenLessons(lucas("finalWeeks"));
    const start = getFinalWeeksStart({ planStart: TODAY, targetDate: addDays(TODAY, 32) });

    expect(firstDay(final)).toBeGreaterThanOrEqual(start.getTime());
    expect(final).toHaveLength(weekly.length);
  });

  it("keeps a civil service exam's two written tests whole in its final weeks", () => {
    const weekly = writtenLessons(rafaela("weekly"));
    const final = writtenLessons(rafaela("finalWeeks"));
    const biweekly = writtenLessons(rafaela("biweekly"));

    expect(final).toHaveLength(weekly.length);
    expect(biweekly).toHaveLength(weekly.length);

    expect(firstDay(final)).toBeGreaterThanOrEqual(addDays(TODAY, 60).getTime());
    expect([...weeksOf(biweekly)].every((week) => week % 2 === 0)).toBe(true);
  });

  it("waits for the final weeks when the other subjects end early", () => {
    const input = examPlan({
      areas: ["Linguagens", "Humanas"],
      cadence: "finalWeeks",
      dailyMinutes: 180,
      days: 120,
      lessons: 8,
      written: ["Redação"],
    });

    const { lessons, written: final } = planLessons(input);
    const start = getFinalWeeksStart({ planStart: TODAY, targetDate: addDays(TODAY, 120) });

    const lastOther = Math.max(
      ...lessons
        .filter((item) => !item.skillId?.startsWith("Redação"))
        .map((item) => (item.scheduledFor ?? TODAY).getTime()),
    );

    expect(final).toHaveLength(WRITTEN_SKILLS * WRITTEN_LESSONS);
    expect(firstDay(final)).toBe(start.getTime());
    expect(lastOther).toBeLessThan(addDays(start, -7).getTime());
  });
});

describe(isWrittenDay, () => {
  const schedule = { planStart: TODAY, targetDate: addDays(TODAY, 90) };

  it("practices every other calendar week from the plan's first, and the final stretch", () => {
    const days = [0, 5, 7, 12, 14, 85].map((offset) =>
      isWrittenDay({ ...schedule, cadence: "biweekly", date: addDays(TODAY, offset) }),
    );

    expect(days).toStrictEqual([true, false, false, true, true, true]);
  });

  it("practices only the final weeks, unless the whole plan is that short or has no date", () => {
    const start = getFinalWeeksStart(schedule);

    expect(toIsoDate(start)).toBe(toIsoDate(addDays(TODAY, 60)));

    expect(isWrittenDay({ ...schedule, cadence: "finalWeeks", date: addDays(start, -1) })).toBe(
      false,
    );

    expect(isWrittenDay({ ...schedule, cadence: "finalWeeks", date: start })).toBe(true);

    expect(
      isWrittenDay({
        cadence: "finalWeeks",
        date: TODAY,
        planStart: TODAY,
        targetDate: addDays(TODAY, 20),
      }),
    ).toBe(true);

    expect(
      isWrittenDay({ cadence: "finalWeeks", date: TODAY, planStart: TODAY, targetDate: null }),
    ).toBe(true);
  });
});
