import { prisma } from "@zoonk/db";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { markPlansChanged } from "../../learner/_utils/mark-learner-changed";
import { planLibraryFixture, unplannedGoalFixture } from "../_test-utils/plan-library";
import { keepPaceOwn } from "../_test-utils/sim/sim-db-pace";
import { readSelectedItemFacts } from "../_utils/selected-item-contract";
import { createGoalPlan } from "../create-goal-plan";
import { refreshGoalPlan } from "../refresh-goal-plan";
import { type BuildPlanInput, buildPlan } from "./build-plan";
import { fromIsoDate, toIsoDate } from "./plan-calendar";
import { parsePlanSettings } from "./plan-state";
import { type QueueUnit } from "./plan-units";
import { type PlanDay } from "./schedule-units";
import { listSelectedItemFacts } from "./selected-item-facts";
import { layOutAfterThisWeek } from "./week-after";

/** A Friday plan whose earlier topic puts Functions' first lesson on Sunday. */
function initialInput(): BuildPlanInput {
  return {
    goal: { dailyMinutes: 45, kind: "learn", targetDate: null },
    graph: {
      phases: [{ milestone: null, name: "Basics" }],
      skills: [
        { area: null, lessons: 10, name: "Earlier topic", phase: 0, skillId: "A", weight: null },
        { area: null, lessons: 20, name: "Functions", phase: 0, skillId: "B", weight: null },
      ],
    },
    items: [],
    lessons: [
      { chapterId: "a", lessonId: "a1", minutes: 8, skillIds: ["A"], title: "Earlier topic" },
      {
        chapterId: "b",
        lessonId: "b1",
        minutes: 8,
        skillIds: ["B"],
        title: "First function lesson",
      },
    ],
    mockMinutes: 150,
    mode: "forced",
    paceFactor: 1,
    prerequisites: new Map(),
    readiness: new Map(),
    settings: parsePlanSettings({ startDate: "2026-10-16" }),
    today: fromIsoDate("2026-10-16"),
  };
}

describe("this week's saved teaching", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    { paceFactor: 1.01, reason: "a slightly slower sampled pace", today: "2026-10-16" },
    { paceFactor: 0.5, reason: "a faster producer pace", today: "2026-10-17" },
  ])(
    "keeps a skill's continuation after its first lesson through $reason",
    ({ paceFactor, today }) => {
      const initial = initialInput();
      const first = buildPlan(initial);
      const facts = listSelectedItemFacts({ built: first, input: initial });

      const items = first.items.map((item, position) => ({
        ...item,
        completedAt: item.lessonId === "a1" ? initial.today : item.completedAt,
        facts: { ...facts.get(item.key), schemaVersion: 1 },
        id: item.key,
        position,
        status: item.lessonId === "a1" ? ("done" as const) : item.status,
      }));

      const savedLesson = items.find((item) => item.lessonId === "b1");
      expect(savedLesson?.scheduledFor).toStrictEqual(fromIsoDate("2026-10-18"));

      const refreshed = buildPlan({
        ...initial,
        items,
        mode: "automatic",
        paceFactor,
        today: fromIsoDate(today),
      });

      const lesson = refreshed.items.find((item) => item.lessonId === "b1");

      const continuation = [...(refreshed.lessonRawMinutes.get("skill:B") ?? [])]
        .filter(([, raw]) => raw > 0)
        .map(([date]) => date)
        .toSorted();

      expect(lesson?.scheduledFor).toStrictEqual(savedLesson?.scheduledFor);
      expect(continuation.length).toBeGreaterThan(0);
      expect(continuation[0]).toBeDefined();

      expect(
        continuation[0]?.localeCompare(toIsoDate(lesson?.scheduledFor ?? initial.today)),
        "Unwritten later lessons cannot take a day before their skill's first saved lesson",
      ).toBeGreaterThanOrEqual(0);
    },
  );

  it("persists a continuation after its first lesson when a completed lesson slows the sampled pace", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-16T12:00:00Z"));

    vi.stubGlobal("fetch", async () => {
      throw new Error("No network in the planner regression");
    });
    // Other parallel learners do not change this learner's fixture pace; own samples still use SQL.
    await keepPaceOwn();

    const [user, library] = await Promise.all([
      userFixture(),
      planLibraryFixture({
        skills: [
          { lessons: 1, size: 10 },
          { lessons: 1, size: 20 },
        ],
      }),
    ]);

    await prisma.lesson.updateMany({
      data: { estimatedMinutes: 8 },
      where: { id: { in: library.lessons.map((lesson) => lesson.id) } },
    });

    const { goal, plan } = await unplannedGoalFixture({
      createdAt: new Date("2026-10-16T12:00:00Z"),
      dailyMinutes: 45,
      settings: { startDate: "2026-10-16" },
      targetDate: null,
      timezone: "UTC",
      userId: user.id,
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    const firstLessonId = library.lessons[0]?.id ?? "";
    const functionLessonId = library.lessons[1]?.id ?? "";
    const functionSkillId = library.skills[1]?.id ?? "";

    const readSaved = () =>
      prisma.plan.findUniqueOrThrow({
        include: { items: { orderBy: { position: "asc" } } },
        where: { id: plan.id },
      });

    const before = await readSaved();
    const savedLesson = before.items.find((item) => item.lessonId === functionLessonId);
    expect(savedLesson?.scheduledFor).toStrictEqual(fromIsoDate("2026-10-18"));
    expect(parsePlanSettings(before.settings).pace?.factor).toBe(1);

    await prisma.$transaction(async (tx) => {
      await markPlansChanged(tx, { planIds: [plan.id] });

      await tx.planItem.updateMany({
        data: { completedAt: new Date(), status: "done" },
        where: { lessonId: firstLessonId, planId: plan.id },
      });
    });

    await Promise.all(
      Array.from({ length: 5 }, () =>
        learningEventFixture({
          contentIds: { lessonId: firstLessonId },
          endedAt: new Date("2001-01-01T12:00:00Z"),
          seconds: 504,
          userId: user.id,
        }),
      ),
    );

    await expect(refreshGoalPlan({ goalId: goal.id, pace: "sampled" })).resolves.toStrictEqual({
      status: "refreshed",
    });

    const after = await readSaved();
    expect(after.version).toBeGreaterThan(before.version);
    expect(parsePlanSettings(after.settings).pace?.factor).toBe(1.01);
    const lesson = after.items.find((item) => item.lessonId === functionLessonId);

    const continuation = after.items.find(
      (item) => item.lessonId === null && item.skillId === functionSkillId,
    );

    const dates = readSelectedItemFacts(continuation?.facts)
      ?.days?.map(([date]) => date)
      .toSorted();

    expect(lesson?.scheduledFor).toStrictEqual(savedLesson?.scheduledFor);
    expect(dates?.length).toBeGreaterThan(0);

    expect(
      dates?.[0]?.localeCompare(toIsoDate(lesson?.scheduledFor ?? fromIsoDate("2026-10-16"))),
      "A saved continuation cannot begin before its skill's first saved lesson",
    ).toBeGreaterThanOrEqual(0);
  });

  it("keeps a new challenge with empty study portions out of the saved week", () => {
    const start = fromIsoDate("2026-10-19");

    const days: PlanDay[] = ["2026-10-16", "2026-10-19"].map((date) => ({
      date: fromIsoDate(date),
      shape: { events: [], minutes: 45, open: true, phase: null, share: 0.5 },
    }));

    const challenge: QueueUnit = {
      area: "Basics",
      chapterId: null,
      key: "boss:0",
      kind: "boss",
      lessonId: null,
      minutes: 10,
      phase: 0,
      skillId: null,
      title: "Basics challenge",
    };

    const laid = layOutAfterThisWeek({
      days,
      kept: [],
      layOut: ({ days: available, units }) => ({
        carriedSchedule: { units: [] },
        restSchedule: {
          units: units.map((unit) => ({
            ...unit,
            date: available[0]?.date ?? start,
            studyMinutes: unit.minutes,
            studyPortions: [],
          })),
        },
      }),
      start,
      units: [challenge],
    });

    expect(laid.restSchedule.units[0]?.date).toStrictEqual(start);
  });
});
