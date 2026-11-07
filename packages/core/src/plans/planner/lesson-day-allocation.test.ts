import { describe, expect, it } from "vitest";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { PLAN_EPSILON } from "./plan-precision";
import { parsePlanSettings } from "./plan-state";
import { listSelectedItemFacts } from "./selected-item-facts";
import { summarizeSelectedPlan } from "./selected-plan-summary";

const START = fromIsoDate("2026-10-10");

function examInput({
  phases = 1,
  minutes = 4,
  count = 8,
  dailyMinutes = 15,
  pace = 1,
} = {}): BuildPlanInput {
  const skills = Array.from({ length: phases }, (_, phase) =>
    ["Civil", "Penal", "Ética"].map((area) => ({
      area,
      lessons: count,
      name: area,
      phase,
      skillId: `${area}${phase}`,
      weight: 3,
    })),
  ).flat();

  return {
    goal: { dailyMinutes, kind: "exam", targetDate: fromIsoDate("2026-11-21") },
    graph: {
      phases: Array.from({ length: phases }, () => ({ milestone: null, name: "Phase" })),
      skills,
    },
    items: [],
    lessons: skills.flatMap((skill) =>
      Array.from({ length: count }, (_, index) => ({
        chapterId: `chapter-${skill.skillId}`,
        lessonId: `${skill.skillId}-${index}`,
        minutes,
        skillIds: [skill.skillId],
        title: `${skill.name} ${index}`,
      })),
    ),
    mockMinutes: 180,
    mode: "forced",
    paceFactor: pace,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: toIsoDate(START) }),
    today: START,
  };
}

function afterMissedDays(input: BuildPlanInput) {
  const items = buildPlan(input).items.map((item, position) => ({
    ...item,
    id: `item-${position}`,
    position,
  }));

  return { ...input, carryOver: { lessonIds: [] }, items, today: addDays(START, 2) };
}

describe("a lesson's saved study days", () => {
  it("never include a rounding leftover after missed days", () => {
    const input = afterMissedDays(examInput());
    const built = buildPlan(input);
    const facts = listSelectedItemFacts({ built, input });

    const leftovers = [...built.lessonRawMinutes].flatMap(([key, days]) =>
      [...days].filter(([, minutes]) => minutes <= PLAN_EPSILON).map(([day]) => ({ day, key })),
    );

    expect(leftovers).toStrictEqual([]);

    const inconsistent = built.items.filter((item) => {
      const days = facts.get(item.key)?.days;

      return (
        days?.length &&
        days.at(-1)?.[0] !==
          (facts.get(item.key)?.teachingEnd ?? (item.scheduledFor && toIsoDate(item.scheduledFor)))
      );
    });

    expect(inconsistent.map((item) => item.key)).toStrictEqual([]);
  });

  it("do not delay a phase challenge for a rounding leftover", () => {
    const input = afterMissedDays(
      examInput({ count: 6, dailyMinutes: 10, minutes: 3, pace: 1.3, phases: 2 }),
    );

    const built = buildPlan(input);

    expect(built.items.find((item) => item.key === "boss:1")?.scheduledFor).toStrictEqual(
      fromIsoDate("2026-11-02"),
    );
  });

  it.each(
    ["forced", "automatic"].flatMap((mode) => [
      { dailyMinutes: 10, minutes: 12, mode: mode as BuildPlanInput["mode"], pace: 1 },
      { dailyMinutes: 10, minutes: 8, mode: mode as BuildPlanInput["mode"], pace: 1.1 },
      { dailyMinutes: 10, minutes: 6, mode: mode as BuildPlanInput["mode"], pace: 1.5 },
      { dailyMinutes: 5, minutes: 5, mode: mode as BuildPlanInput["mode"], pace: 1 },
    ]),
  )(
    "end consistently at $minutes minutes, pace $pace, and $dailyMinutes minutes a day in $mode mode",
    ({ dailyMinutes, minutes, mode, pace }) => {
      const today = fromIsoDate("2026-10-12");

      const input: BuildPlanInput = {
        ...examInput({ count: 2, dailyMinutes, minutes, pace }),
        goal: { dailyMinutes, kind: "exam", targetDate: addDays(today, 3) },
        mode,
        settings: parsePlanSettings({ startDate: toIsoDate(today) }),
        today,
      };

      const built = buildPlan(input);
      const first = built.items.find((item) => item.kind === "lesson");
      const facts = listSelectedItemFacts({ built, input }).get(first?.key ?? "");

      expect(first?.scheduledFor).toStrictEqual(today);
      expect(facts?.teachingEnd).toBe("2026-10-13");

      expect(facts?.days?.map(([date, studyMinutes]) => [date, studyMinutes])).toStrictEqual([
        ["2026-10-12", dailyMinutes],
        ["2026-10-13", (first?.minutes ?? 0) - dailyMinutes],
      ]);

      expect(summarizeSelectedPlan({ built, examSubjects: null, input }).endDate).toBe(
        "2026-10-13",
      );
    },
  );

  it("leaves study time in the first week of a new plan with unwritten lessons", () => {
    const today = fromIsoDate("2026-10-12");

    const input: BuildPlanInput = {
      ...examInput({ phases: 2 }),
      bossFacts: {
        bank: { recordingSets: [], textCounts: new Map() },
        listeningSkillIds: new Set(),
        rows: { chapterLessons: [], lessonSkills: [] },
        survivors: new Map(),
      },
      goal: { dailyMinutes: 20, kind: "exam", targetDate: addDays(today, 21) },
      graph: {
        phases: [
          { milestone: null, name: "First" },
          { milestone: null, name: "Second" },
        ],
        skills: [4, 5, 1, 4].map((weight, index) => ({
          area: `Area ${index % 3}`,
          lessons: 32,
          name: `Skill ${index}`,
          phase: index < 2 ? 0 : 1,
          skillId: `S${index}`,
          weight,
        })),
      },
      lessons: [],
      settings: parsePlanSettings({
        practiceBias: "moreExplanation",
        startDate: toIsoDate(today),
        weekdayMinutes: [0, 20, 20, 20, 20, 20, 0],
      }),
      today,
    };

    const built = buildPlan(input);

    expect(
      built.items.some(
        (item) => item.kind === "lesson" && item.scheduledFor?.getTime() === today.getTime(),
      ),
    ).toBe(true);

    expect(
      [...built.lessonRawMinutes.values()].some(
        (days) => (days.get(toIsoDate(today)) ?? 0) > PLAN_EPSILON,
      ),
    ).toBe(true);
  });
});
