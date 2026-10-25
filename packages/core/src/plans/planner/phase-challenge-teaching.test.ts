import { describe, expect, it } from "vitest";
import { getBossSkillIds } from "../../checkpoints/checkpoint-rules";
import { toBossPlan } from "./boss-plan";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { placeExamBosses } from "./exam-boss-days";
import { addDays, fromIsoDate, toIsoDate } from "./plan-calendar";
import { parsePlanSettings } from "./plan-state";
import { DEFAULT_LESSON_MINUTES } from "./plan-units";

/**
 * An exam whose one subject (s1) has lessons in every phase, with two skills (s2, s3) planned as
 * stand-ins in the second: the first phase's challenge asks s1, and the second's used to ask only
 * s2 and s3, in the middle of its phase, while four of its days of s1 lessons came after it.
 */
function examInput(): BuildPlanInput {
  return {
    goal: { dailyMinutes: 45, kind: "exam", targetDate: fromIsoDate("2026-11-08") },
    graph: {
      phases: [{ milestone: null, name: "Everything" }],
      skills: [5, 1, 3].map((weight, index) => ({
        area: null,
        lessons: 2,
        name: `Skill s${index + 1}`,
        phase: 0,
        skillId: `s${index + 1}`,
        weight,
      })),
    },
    items: [],
    lessons: Array.from({ length: 400 }, (_, index) => ({
      chapterId: "chapter",
      lessonId: `l${index}`,
      minutes: 3,
      skillIds: ["s1"],
      title: `Lesson l${index}`,
    })),
    mockMinutes: 45,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map([["s3", ["s2"]]]),
    readiness: new Map(),
    settings: parsePlanSettings({
      startDate: "2026-09-23",
      weekdayMinutes: [0, 45, 45, 45, 45, 45, 45],
    }),
    today: fromIsoDate("2026-09-23"),
  };
}

const LEARN_KINDS = new Set(["chapter", "lesson"]);

describe("a phase's challenge tests its own phase's teaching", () => {
  const input = examInput();
  const built = buildPlan(input);
  const plan = toBossPlan({ input, items: built.items, skillLessons: built.skillLessons });
  const bosses = plan.items.filter((item) => item.kind === "boss");

  const lastLessonTime = (phase: number) =>
    Math.max(
      ...plan.items
        .filter((item) => LEARN_KINDS.has(item.kind) && item.phase === phase)
        .map((item) => item.scheduledFor?.getTime() ?? 0),
    );

  it("comes after every lesson its phase teaches", () => {
    expect(bosses.length).toBeGreaterThan(1);

    for (const boss of bosses) {
      expect(boss.scheduledFor?.getTime()).toBeGreaterThan(lastLessonTime(boss.phase));
    }
  });

  it("comes on the first study day after its own teaching ends", () => {
    for (const boss of bosses) {
      const ends = plan.items
        .filter((item) => LEARN_KINDS.has(item.kind) && item.phase === boss.phase)
        .map((item) => toIsoDate(built.teachingEnds.get(item.key) ?? item.scheduledFor!))
        .toSorted();

      const last = ends.at(-1);

      expect(last).toBeDefined();

      expect(toIsoDate(boss.scheduledFor!)).toBe(
        built.studyDays.find((day) => last !== undefined && day > last),
      );
    }
  });

  it("asks the subject its phase teaches, though an earlier phase's challenge asked it too", () => {
    const second = bosses.find((boss) => boss.phase === 1);

    if (!second) {
      throw new Error("Expected the second phase's challenge");
    }

    expect(getBossSkillIds({ ...plan, boss: second })).toContain("s1");
  });

  it("tests the lessons of its own phase, none of an earlier one's", () => {
    const placed = placeExamBosses({ built, input });
    const phaseOf = new Map(plan.items.map((item) => [item.id, item.phase]));

    for (const [key, day] of placed) {
      const phase = Number(key.slice(key.indexOf(":") + 1));

      expect(day.tested?.length).toBeGreaterThan(0);
      expect((day.tested ?? []).every((tested) => phaseOf.get(tested) === phase)).toBe(true);
    }
  });
});

describe("overlapping phase teaching", () => {
  it("keeps the after-exam teaching end of a stand-in begun in its own phase", () => {
    const input: BuildPlanInput = {
      ...examInput(),
      goal: { dailyMinutes: 30, kind: "exam", targetDate: fromIsoDate("2026-11-01") },
      graph: {
        phases: [{ milestone: null, name: "Law" }],
        skills: [{ area: "Law", lessons: 600, name: "Law", phase: 0, skillId: "law", weight: 5 }],
      },
      lessons: [],
      mockMinutes: 30,
      prerequisites: new Map(),
      settings: parsePlanSettings({ fullCourse: true, startDate: "2026-09-28" }),
      today: fromIsoDate("2026-09-28"),
    };

    const built = buildPlan(input);
    const teaching = built.items.filter((item) => item.kind === "lesson");
    const law = teaching[0];
    const after = built.phases.find((phase) => phase.kind === "afterExam");

    expect(teaching).toHaveLength(1);
    expect(law?.phase).toBe(0);

    if (!law || !after?.endDate) {
      throw new Error("Expected one joined Law stand-in continuing after the exam");
    }

    expect(Date.parse(after.endDate)).toBeGreaterThan(Date.parse("2026-11-01"));

    const portions = [...(built.lessonRawMinutes.get(law.key) ?? [])];

    const end = portions
      .map(([day]) => day)
      .toSorted()
      .at(-1)!;

    expect(portions.reduce((sum, [, minutes]) => sum + minutes, 0)).toBeCloseTo(
      600 * DEFAULT_LESSON_MINUTES,
      6,
    );

    expect(Date.parse(end)).toBeGreaterThan(Date.parse("2026-11-01"));
    expect(toIsoDate(built.teachingEnds.get(law.key)!)).toBe(end);

    const beforeExam = portions
      .map(([day]) => day)
      .filter((day) => day < "2026-11-01")
      .toSorted()
      .at(-1)!;

    const first = built.studyDays.find((day) => day > beforeExam);
    const challenge = built.items.find((item) => item.key === "boss:0");

    expect(first).toBeDefined();
    expect(toIsoDate(challenge!.scheduledFor!)).toBe(first);
    const dated = buildPlan({ ...input, settings: { ...input.settings, fullCourse: false } });

    expect(challenge?.scheduledFor).toStrictEqual(
      dated.items.find((item) => item.key === "boss:0")?.scheduledFor,
    );
  });

  it("does not postpone a phase for another phase's long stand-in", () => {
    const input: BuildPlanInput = {
      ...examInput(),
      goal: { dailyMinutes: 30, kind: "exam", targetDate: fromIsoDate("2026-11-01") },
      graph: {
        phases: [
          { milestone: null, name: "Basics" },
          { milestone: null, name: "Core" },
        ],
        skills: [
          { area: "Math", lessons: 80, name: "Math", phase: 0, skillId: "math", weight: 5 },
          { area: "Law", lessons: 30, name: "Law", phase: 1, skillId: "law", weight: 3 },
        ],
      },
      lessons: Array.from({ length: 80 }, (_, index) => ({
        chapterId: "chapter",
        lessonId: `math${index}`,
        minutes: 3,
        skillIds: ["math"],
        title: `Math ${index}`,
      })),
      mockMinutes: 30,
      prerequisites: new Map(),
      settings: parsePlanSettings({ fullCourse: true, startDate: "2026-09-28" }),
      today: fromIsoDate("2026-09-28"),
    };

    const built = buildPlan(input);
    const gaps = built.items.filter((item) => item.kind === "lesson" && item.phase === 1);

    const end = gaps
      .map((item) => toIsoDate(built.teachingEnds.get(item.key) ?? item.scheduledFor!))
      .toSorted()
      .at(-1)!;

    const first = built.studyDays.find((day) => day > end);
    const placed = placeExamBosses({ built, input });
    const challenge = built.items.find((item) => item.key === "boss:1");

    expect(gaps.length).toBeGreaterThan(0);
    expect(first).toBe("2026-10-19");
    expect(placed.get("boss:1")?.date).toBe(first);
    expect(toIsoDate(challenge!.scheduledFor!)).toBe(first);
    expect(built.bossFallback).toBeUndefined();
  });
});

describe("a challenge near a mock", () => {
  // Core's challenge on Nov 4, inside the Nov 6 mock's funding window, moved Core's last lessons
  // past it; on Nov 9, outside it, they came back: the plan was built again and again, fell back
  // and logged an error on every Plan view. Its time now runs on top of its day.
  it("goes on the first study day after its teaching, its time asked of that day on top", () => {
    const input: BuildPlanInput = {
      ...examInput(),
      goal: { dailyMinutes: 45, kind: "exam", targetDate: fromIsoDate("2026-11-20") },
      graph: {
        phases: [
          { milestone: null, name: "Basics" },
          { milestone: null, name: "Core" },
          { milestone: null, name: "Review" },
        ],
        skills: [
          { area: "Math", lessons: 30, name: "Algebra", phase: 0, skillId: "s0", weight: 5 },
          { area: "Math", lessons: 2, name: "Sets", phase: 0, skillId: "s1", weight: 3 },
          { area: "Port", lessons: 60, name: "Grammar", phase: 1, skillId: "s2", weight: 5 },
          { area: "Port", lessons: 16, name: "Reading", phase: 2, skillId: "s3", weight: 5 },
        ],
      },
      lessons: [],
      mockMinutes: 150,
      prerequisites: new Map(),
      settings: parsePlanSettings({
        startDate: "2026-10-24",
        weekdayMinutes: [0, 45, 45, 45, 45, 45, 0],
      }),
      today: fromIsoDate("2026-10-24"),
    };

    const built = buildPlan(input);
    const core = built.items.filter((item) => item.kind === "lesson" && item.phase === 1);

    const end = core
      .map((item) => toIsoDate(built.teachingEnds.get(item.key) ?? item.scheduledFor!))
      .toSorted()
      .at(-1)!;

    const challenge = built.items.find((item) => item.key === "boss:1");
    const day = toIsoDate(challenge!.scheduledFor!);

    expect(built.mockFunding.map((mock) => mock.date)).toStrictEqual(["2026-11-06"]);
    expect(built.bossFallback).toBeUndefined();
    expect(day).toBe(built.studyDays.find((study) => study > end));
    expect(built.checkpointOverflow).toContainEqual({ date: day, minutes: challenge!.minutes });
  });
});

describe("a finished challenge on a short day", () => {
  // The run after it priced it once at its full time and again inside the day it left: a learner
  // studying 5 minutes a day saw 25 more minutes asked of that day instead of 15.
  it("asks its day for its time once, on top", () => {
    const input: BuildPlanInput = {
      ...examInput(),
      goal: { dailyMinutes: 5, kind: "exam", targetDate: fromIsoDate("2026-11-08") },
      settings: parsePlanSettings({
        startDate: "2026-09-23",
        weekdayMinutes: [0, 5, 5, 5, 5, 5, 5],
      }),
    };

    const first = buildPlan(input);
    const challenge = first.items.find((item) => item.key === "boss:0");
    const day = challenge?.scheduledFor;

    if (!challenge || !day) {
      throw new Error("Expected the first phase's challenge");
    }

    const items = first.items.map((item, position) => ({
      ...item,
      id: item.key,
      position,
      ...(item.scheduledFor && item.scheduledFor <= day
        ? { completedAt: item.scheduledFor, status: "done" as const }
        : {}),
    }));

    const next = buildPlan({ ...input, items, mode: "automatic", today: addDays(day, 1) });

    expect(next.checkpointOverflow).toContainEqual({
      date: toIsoDate(day),
      minutes: challenge.minutes,
    });
  });
});
