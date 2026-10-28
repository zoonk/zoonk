import { describe, expect, it } from "vitest";
import { getBossSkillIds } from "../../checkpoints/checkpoint-rules";
import { continueAfterExam } from "./after-exam";
import { toBossPlan } from "./boss-plan";
import { listBossCandidates, projectBossPlan } from "./boss-projection";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { type PlannedItem } from "./plan-items";
import { parsePlanSettings } from "./plan-state";

const TODAY = fromIsoDate("2026-09-28");

function examPlan({
  lessons,
  standIn,
  targetDate,
}: {
  lessons: number;
  standIn: number;
  targetDate: string;
}): BuildPlanInput {
  return {
    goal: { dailyMinutes: 30, kind: "exam", targetDate: fromIsoDate(targetDate) },
    graph: {
      phases: [
        { milestone: null, name: "Basics" },
        { milestone: null, name: "Core" },
      ],
      skills: [
        { area: "Math", lessons, name: "Math", phase: 0, skillId: "math", weight: 5 },
        { area: "Law", lessons: standIn, name: "Law", phase: 1, skillId: "law", weight: 3 },
      ],
    },
    items: [],
    lessons: Array.from({ length: lessons }, (_, index) => ({
      chapterId: "chapter",
      lessonId: `math${index}`,
      minutes: 3,
      skillIds: ["math"],
      title: `Math ${index}`,
    })),
    mockMinutes: 30,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ fullCourse: true, startDate: toIsoDate(TODAY) }),
    today: TODAY,
  };
}

function dayOf(item: Pick<PlannedItem, "scheduledFor"> | undefined): string {
  return item?.scheduledFor ? toIsoDate(item.scheduledFor) : "";
}

function listBossDays(plan: ReturnType<typeof buildPlan>): [string, string][] {
  return plan.items.filter((item) => item.kind === "boss").map((item) => [item.key, dayOf(item)]);
}

function listBossTeaching(input: BuildPlanInput, plan: ReturnType<typeof buildPlan>) {
  const saved = toBossPlan({ input, items: plan.items, skillLessons: plan.skillLessons });

  return saved.items
    .filter((item) => item.kind === "boss")
    .map((boss) => {
      const asked = new Set(getBossSkillIds({ ...saved, boss }));

      const ends = saved.items
        .filter(
          (item) =>
            item.position < boss.position &&
            (item.kind === "lesson" || item.kind === "chapter") &&
            (saved.itemSkillIds.get(item.id) ?? []).some((skillId) => asked.has(skillId)),
        )
        .flatMap((item) => [...(plan.lessonRawMinutes.get(item.key)?.keys() ?? [])])
        .filter((day) => day < toIsoDate(input.goal.targetDate!))
        .toSorted();

      return { boss, end: ends.at(-1) ?? null };
    });
}

describe("a phase's challenge in a plan that goes on after its exam", () => {
  it.each([
    { lessons: 80, standIn: 30, targetDate: "2026-11-01" },
    { lessons: 80, standIn: 10, targetDate: "2026-10-25" },
  ])("goes after what it tests, its own phase's, once", (attrs) => {
    const input = examPlan(attrs);
    const plan = buildPlan(input);
    const bosses = plan.items.filter((item) => item.kind === "boss");
    const afterExam = plan.phases.findIndex((phase) => phase.kind === "afterExam");
    const teaching = listBossTeaching(input, plan);

    expect(plan.bossFallback).toBeUndefined();
    expect(new Set(bosses.map((boss) => boss.key)).size).toBe(bosses.length);
    expect(bosses.every((boss) => boss.key === `boss:${boss.phase}`)).toBe(true);
    expect(bosses.some((boss) => boss.phase === afterExam)).toBe(false);
    expect(teaching.every(({ boss, end }) => end === null || end < dayOf(boss))).toBe(true);
  });

  it("keeps a challenge with no study day left before the exam beside its lessons", () => {
    const input = examPlan({ lessons: 80, standIn: 30, targetDate: "2026-10-27" });
    const settings = { ...input.settings, weekdayMinutes: [0, 30, 30, 30, 30, 30, 0] };
    const plan = buildPlan({ ...input, settings });
    const dated = buildPlan({ ...input, settings: { ...settings, fullCourse: false } });

    expect(listBossDays(dated)).toContainEqual(["boss:2", "2026-10-22"]);
    expect(listBossDays(plan)).toStrictEqual(listBossDays(dated));
  });

  it("goes on its day after the exam when one is placed there", () => {
    const targetDate = fromIsoDate("2026-10-25");

    const afterExam = continueAfterExam({
      bossDays: new Map([["boss:1", { beside: false, date: "2026-10-27" }]]),
      bossMinutes: () => 15,
      calendar: { dailyMinutes: 30, firstDay: null, lightWeeks: [], weekdayMinutes: null },
      dropped: [],
      goal: { kind: "exam", targetDate },
      mockMinutes: 30,
      phase: 4,
      saved: [],
      settings: { fullCourse: true, movedEvents: [], practiceBias: "balanced" },
      start: TODAY,
    });

    const bosses = afterExam?.events.filter((event) => event.kind === "boss") ?? [];

    expect(
      bosses.map((boss) => [boss.key, boss.phase, toIsoDate(boss.date), boss.minutes]),
    ).toStrictEqual([["boss:1", 1, "2026-10-27", 15]]);

    expect(afterExam?.span?.end).toStrictEqual(fromIsoDate("2026-10-27"));
  });
});

function project(input: BuildPlanInput, plan: ReturnType<typeof buildPlan>): string[] {
  const candidates = listBossCandidates({ built: plan });
  return projectBossPlan({ built: plan, candidates, input }).plan.items.map((item) => item.id);
}

describe("the challenges' projection of a plan", () => {
  it.each([
    { lessons: 40, standIn: 60, targetDate: "2026-11-08" },
    { lessons: 60, standIn: 120, targetDate: "2026-11-01" },
  ])("orders its items as the saved plan does", (attrs) => {
    const input = examPlan(attrs);
    const plan = buildPlan(input);

    expect(project(input, plan)).toStrictEqual(plan.items.map((item) => item.key));
  });

  it("keeps a finished challenge where the plan keeps it", () => {
    const input = examPlan({ lessons: 40, standIn: 60, targetDate: "2026-11-08" });

    const items = buildPlan(input).items.map((item, position) => ({
      ...item,
      id: item.key,
      position,
      ...(item.key === "boss:0" ? { completedAt: TODAY, status: "done" as const } : {}),
    }));

    const next = { ...input, items, mode: "automatic" as const };
    const plan = buildPlan(next);

    expect(plan.items.find((item) => item.key === "boss:0")?.status).toBe("done");
    expect(project(next, plan)).toStrictEqual(plan.items.map((item) => item.key));
  });
});

describe("a phase's challenge the learner left on an earlier day", () => {
  it.each([
    { day: "2026-10-31", movedEvents: [] },
    { day: "2026-11-02", movedEvents: [] },
    { day: "2026-10-30", movedEvents: [{ from: "2026-10-25", to: "2026-10-30" }] },
  ])("keeps an unfinished challenge when replanning on $day", ({ day, movedEvents }) => {
    const input = examPlan({ lessons: 80, standIn: 600, targetDate: "2026-11-01" });
    const first = buildPlan(input);
    const today = fromIsoDate(day);

    const items = first.items.map((item, position) => ({
      ...item,
      id: item.key,
      position,
      ...(item.kind === "lesson" && item.lessonId
        ? { completedAt: item.scheduledFor, status: "done" as const }
        : {}),
    }));

    const pending = first.items.filter((item) => item.kind === "boss");

    const replanned = buildPlan({
      ...input,
      items,
      settings: { ...input.settings, movedEvents },
      today,
    });

    expect(pending.length).toBeGreaterThan(0);

    for (const boss of pending) {
      expect(replanned.items.find((item) => item.key === boss.key)).toMatchObject({
        kind: "boss",
        status: "todo",
      });

      expect(
        replanned.items.find((item) => item.key === boss.key)?.scheduledFor?.getTime(),
      ).toBeGreaterThanOrEqual(today.getTime());
    }
  });

  it("goes on a day from the run's first on", () => {
    const input = examPlan({ lessons: 80, standIn: 10, targetDate: "2026-10-25" });
    const first = buildPlan(input);
    const boss = first.items.find((item) => item.key === "boss:0");
    const later = fromIsoDate("2026-10-14");

    expect(dayOf(boss) < "2026-10-14").toBe(true);

    const items = first.items.map((item, position) => ({
      ...item,
      id: item.key,
      position,
      ...(item.kind !== "boss" && item.scheduledFor && item.scheduledFor < later
        ? { completedAt: item.scheduledFor, status: "done" as const }
        : {}),
    }));

    const settled = buildPlan({ ...input, items, today: later });
    const again = settled.items.find((item) => item.key === "boss:0");

    expect(again?.status).toBe("todo");
    expect(dayOf(again) >= "2026-10-14").toBe(true);
  });
});
