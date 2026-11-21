import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { startLearningEvent } from "../stats/record-learning-event";
import { getSyllabusView } from "../view-models/syllabus/get-syllabus-view";
import { AHEAD_START, readPlanScreen } from "./_test-utils/ahead-plan";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createSetUpGoalPlan } from "./_test-utils/set-up-plan";
import { changeGoalPlan } from "./change-goal-plan";
import { addDays } from "./planner/plan-calendar";
import { parsePlanGraph, parsePlanSettings } from "./planner/plan-state";

describe("exam strategy", () => {
  afterEach(() => vi.useRealTimers());

  it("offers strategy only when all its lessons fit and remembers the choice when time runs short", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AHEAD_START);

    const [user, library] = await Promise.all([
      userFixture(),
      planLibraryFixture({
        skills: [
          { area: "Math", lessons: 1 },
          { area: "Exam strategy", lessons: 5 },
        ],
      }),
    ]);

    const [math, strategy] = library.graph.skills;

    const { goal, plan } = await unplannedGoalFixture({
      dailyMinutes: 40,
      details: { placementDeclined: true },
      kind: "exam",
      settings: { startDate: "2020-09-29" },
      targetDate: addDays(new Date("2020-09-29"), 6),
      timezone: "UTC",
      userId: user.id,
    });

    const graph = {
      ...library.graph,
      extraSkills: [strategy!],
      skills: [{ ...math!, topics: ["Fractions"] }],
    };

    await createSetUpGoalPlan({ goalId: goal.id, graph });
    mockSession(user.id);

    const listItems = () =>
      prisma.planItem.findMany({
        orderBy: { position: "asc" },
        where: { kind: "lesson", planId: plan.id, status: "todo" },
      });

    const countExtraItems = () =>
      prisma.planItem.count({
        where: { kind: "lesson", planId: plan.id, skillId: strategy!.skillId, status: "todo" },
      });

    const skillIds = [strategy!.skillId];
    const operations = [{ kind: "setExtras" as const, skillIds }];

    const edit = (changes: Parameters<typeof changeGoalPlan>[0]["input"]["operations"]) =>
      changeGoalPlan({ goalId: goal.id, input: { operations: changes } });

    const before = await readPlanScreen();
    expect(before?.extraOffer).toMatchObject({ canApply: true, lessons: 5, operations });
    await expect(listItems()).resolves.toMatchObject([{ skillId: math!.skillId }]);

    await expect(edit([{ kind: "setExtras", skillIds: [math!.skillId] }])).resolves.toStrictEqual({
      error: "extraUnavailable",
      status: "invalid",
    });

    await expect(edit(operations)).resolves.toMatchObject({ status: "applied" });
    await expect(countExtraItems()).resolves.toBe(5);
    await expect(readPlanScreen()).resolves.toMatchObject({ extraOffer: null });

    const accepted = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    const changes = await prisma.planChange.count({ where: { planId: plan.id } });

    await expect(edit(operations)).resolves.toStrictEqual({
      reason: "alreadyIn",
      status: "unchanged",
    });

    await expect(prisma.planChange.count({ where: { planId: plan.id } })).resolves.toBe(changes);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toStrictEqual(
      accepted,
    );

    await expect(getSyllabusView({ goalId: goal.id })).resolves.toMatchObject({
      status: "ready",
      syllabus: {
        hasNotice: false,
        subjectCount: 1,
        subjects: [
          { name: "Math" },
          {
            extra: true,
            lessonsDone: 0,
            lessonsTotal: 5,
            name: "Exam strategy",
            preparation: null,
          },
        ],
      },
    });

    await expect(
      edit([
        { kind: "setDailyMinutes", minutes: 5 },
        { kind: "setTargetDate", targetDate: "2020-09-30" },
      ]),
    ).resolves.toMatchObject({ status: "applied" });

    await expect(countExtraItems()).resolves.toBe(0);
    const tight = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    expect(parsePlanSettings(tight.settings).extras).toStrictEqual(skillIds);
    expect(parsePlanGraph(tight.graph).skills.some((skill) => skill.extra)).toBe(false);

    await expect(getSyllabusView({ goalId: goal.id })).resolves.toMatchObject({
      status: "ready",
      syllabus: { subjectCount: 1, subjects: [{ name: "Math" }] },
    });

    await expect(readPlanScreen()).resolves.toMatchObject({ extraOffer: null });

    await expect(
      edit([
        { kind: "setDailyMinutes", minutes: 40 },
        { kind: "setTargetDate", targetDate: "2020-10-05" },
      ]),
    ).resolves.toMatchObject({ status: "applied" });

    await expect(countExtraItems()).resolves.toBe(5);

    const open = await prisma.planItem.findFirstOrThrow({
      orderBy: { position: "asc" },
      where: { kind: "lesson", planId: plan.id, skillId: strategy!.skillId, status: "todo" },
    });

    await startLearningEvent(prisma, {
      contentIds: { lessonId: open.lessonId! },
      goalId: goal.id,
      kind: "lesson",
      lessonKind: "library",
      startedAt: AHEAD_START,
      timeZone: "UTC",
      titleSnapshot: open.titleSnapshot,
      userId: user.id,
    });

    await expect(
      edit([
        { kind: "setDailyMinutes", minutes: 5 },
        { kind: "setTargetDate", targetDate: "2020-09-30" },
      ]),
    ).resolves.toMatchObject({ status: "applied" });

    await expect(countExtraItems()).resolves.toBe(1);

    await expect(prisma.planItem.findUnique({ where: { id: open.id } })).resolves.toMatchObject({
      status: "todo",
    });
  });
});
