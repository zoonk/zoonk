import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { courseChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getChallenge } from "../checkpoints/get-challenge";
import { startChallenge } from "../checkpoints/start-challenge";
import { completeLibraryLesson } from "../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { openTodayView } from "../sessions/_test-utils/open-today-view";
import { readBlockPayload } from "../sessions/block-payload";
import { planLibraryFixture, unplannedGoalFixture } from "./_test-utils/plan-library";
import { createGoalPlan } from "./create-goal-plan";
import { getGoalPlan } from "./get-goal-plan";
import { refreshGoalPlan } from "./refresh-goal-plan";

const START = "2020-09-28";

function on(date: string) {
  vi.setSystemTime(new Date(`${date}T12:00:00Z`));
}

async function setup({
  dailyMinutes = 60,
  estimatedMinutes = 3,
  phases = 1,
  targetDate = null,
}: {
  dailyMinutes?: number;
  estimatedMinutes?: number;
  phases?: number;
  targetDate?: string | null;
} = {}) {
  const [user, course, library] = await Promise.all([
    userFixture(),
    courseFixture({ isPublished: true, outlineStatus: "completed", visibility: "public" }),
    planLibraryFixture({
      phases: Array.from({ length: phases }, (_, index) => `Phase ${index + 1}`),
      skills: Array.from({ length: phases }, (_, phase) => ({ area: "Math", lessons: 1, phase })),
    }),
  ]);

  await Promise.all([
    prisma.lesson.updateMany({
      data: { contentStatus: "completed", estimatedMinutes, specStatus: "completed" },
      where: { id: { in: library.lessons.map((lesson) => lesson.id) } },
    }),
    ...library.lessons.map((lesson) => libraryStepFixture({ lessonId: lesson.id })),
    ...library.chapters.map((chapter, position) =>
      courseChapterFixture({ area: "Math", chapterId: chapter.id, courseId: course.id, position }),
    ),
    ...library.skills.flatMap((skill) =>
      Array.from({ length: 10 }, () =>
        itemFixture({ content: choiceItemContent(), skillId: skill.id }),
      ),
    ),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    createdAt: new Date(START),
    dailyMinutes,
    details: {
      answered: ["targetDate", "schedule"],
      courseStart: { chapterId: library.chapters[0]?.id ?? null },
      placementDeclined: true,
    },
    kind: "learn",
    primaryCourseId: course.id,
    settings: {
      startDate: START,
      weekdayMinutes: [0, dailyMinutes, dailyMinutes, dailyMinutes, dailyMinutes, dailyMinutes, 0],
    },
    targetDate: targetDate ? new Date(targetDate) : null,
    timezone: "UTC",
    userId: user.id,
  });

  mockSession(user.id);

  await expect(createGoalPlan({ goalId: goal.id, graph: library.graph })).resolves.toMatchObject({
    status: "created",
  });

  return { course, goal, library, plan, user };
}

async function readItems(planId: string) {
  return prisma.planItem.findMany({ orderBy: { position: "asc" }, where: { planId } });
}

async function readToday(goalId: string) {
  const result = await openTodayView({ goalId, timeZone: "UTC" });

  const session = await prisma.studySession.findUniqueOrThrow({
    include: { blocks: { orderBy: { position: "asc" } } },
    where: { id: result.today.session.id },
  });

  return { session, today: result.today };
}

async function complete(lessonId: string, sessionId: string) {
  const started = await startLibraryLesson({
    input: { studySessionId: sessionId, timeZone: "UTC" },
    lessonId,
  });

  if (started.status !== "started") {
    throw new Error(`Expected the real lesson start: ${started.status}`);
  }

  await expect(
    completeLibraryLesson({ input: { runId: started.run.runId, timeZone: "UTC" }, lessonId }),
  ).resolves.toMatchObject({ status: "completed" });
}

describe("a course boss follows its teaching in plan order", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    on(START);
  });

  afterEach(() => vi.useRealTimers());

  it("offers and starts the boss after its lesson on the same day", async () => {
    const { goal, library, plan } = await setup();
    const items = await readItems(plan.id);
    const lesson = items.find((item) => item.kind === "lesson");
    const boss = items.find((item) => item.kind === "boss");

    expect.soft(lesson?.scheduledFor).toStrictEqual(new Date(START));
    expect.soft(boss?.scheduledFor).toStrictEqual(new Date("2020-09-29"));

    if (!boss || !lesson?.lessonId) {
      throw new Error("Expected the actual lesson and boss");
    }

    const initial = await readToday(goal.id);
    await complete(lesson.lessonId, initial.session.id);
    const beforeGap = await readToday(goal.id);

    expect
      .soft(
        beforeGap.session.blocks.some((block) => readBlockPayload(block).planItemId === boss.id),
      )
      .toBe(true);

    await expect
      .soft(getChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id }))
      .resolves.toMatchObject({
        challenge: {
          date: null,
          minutes: 15,
          questions: 10,
          status: "ready",
          topics: [{ name: library.skills[0]?.name }],
        },
        status: "ready",
      });

    await expect(
      startChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id }),
    ).resolves.toMatchObject({ status: "ready" });
  });

  it("lets a 15-minute boss lead the next 10-minute study day, with Plan, Today and the actual block sharing its whole duration", async () => {
    const { goal, plan } = await setup({ dailyMinutes: 10, estimatedMinutes: 5, phases: 2 });
    const before = await readItems(plan.id);
    const boss = before.find((item) => item.kind === "boss" && item.phase === 0);
    const lesson = before.find((item) => item.kind === "lesson" && item.phase === 0);

    expect.soft(boss?.scheduledFor).toStrictEqual(new Date("2020-09-29"));

    if (!boss || !lesson?.lessonId) {
      throw new Error("Expected the actual first phase");
    }

    const firstDay = await readToday(goal.id);
    await complete(lesson.lessonId, firstDay.session.id);
    on("2020-09-29");
    const result = await readToday(goal.id);
    const view = await getGoalPlan(goal.id);

    expect
      .soft(view)
      .toMatchObject({
        plan: {
          week: {
            days: expect.arrayContaining([
              expect.objectContaining({ date: "2020-09-29", minutes: 15 }),
            ]),
          },
        },
        status: "ready",
      });

    expect.soft(result.today.session.minutes.dailyGoal).toBe(10);

    const block = result.session.blocks.find(
      (entry) => readBlockPayload(entry).planItemId === boss.id,
    );

    expect.soft(block?.estimatedMinutes).toBe(15);
    expect.soft(result.session.blocks[0]?.id).toBe(block?.id);

    const after = await readItems(plan.id);

    expect
      .soft(after.find((item) => item.kind === "lesson" && item.phase === 1)?.scheduledFor)
      .toStrictEqual(new Date("2020-09-30"));

    await expect(
      startChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id }),
    ).resolves.toMatchObject({ destination: { kind: "checkpoint" }, status: "ready" });
  });

  it("keeps the last-day lesson within its minutes and puts off the challenge", async () => {
    const { goal, plan } = await setup({
      dailyMinutes: 10,
      estimatedMinutes: 10,
      targetDate: "2020-09-29",
    });

    const items = await readItems(plan.id);
    const lesson = items.find((item) => item.kind === "lesson");
    const boss = items.find((item) => item.kind === "boss");
    expect.soft(items.filter((item) => item.kind === "lesson")).toHaveLength(1);
    expect.soft(items.filter((item) => item.kind === "boss")).toHaveLength(1);
    expect.soft(lesson?.scheduledFor).toStrictEqual(new Date(START));
    expect.soft(boss?.scheduledFor).toStrictEqual(new Date(START));

    if (!boss || !lesson?.lessonId) {
      throw new Error("Expected the last-day lesson and unsuppressed boss");
    }

    const result = await readToday(goal.id);
    const view = await getGoalPlan(goal.id);

    expect
      .soft(view)
      .toMatchObject({
        plan: {
          week: {
            days: expect.arrayContaining([expect.objectContaining({ date: START, minutes: 25 })]),
          },
        },
        status: "ready",
      });

    expect.soft(result.today.session.minutes.dailyGoal).toBe(10);
    expect.soft(result.session.blocks.map((block) => block.kind)).toStrictEqual(["learn"]);
    expect.soft(result.session.plannedMinutes).toBe(10);
    await complete(lesson.lessonId, result.session.id);

    await expect(
      startChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id }),
    ).resolves.toMatchObject({ status: "notToday" });
  });

  it("keeps the moved estimate but offers the challenge after its deferred lesson", async () => {
    const { goal, library, plan } = await setup();
    const before = await readItems(plan.id);
    const boss = before.find((item) => item.kind === "boss");

    if (!boss) {
      throw new Error("Expected the actual held boss");
    }

    on("2020-09-29");
    await refreshGoalPlan({ goalId: goal.id, pace: "saved" });
    const after = await readItems(plan.id);
    const held = after.find((item) => item.id === boss.id);
    const carried = after.find((item) => item.lessonId === library.lessons[0]?.id);
    expect.soft(carried?.scheduledFor).toStrictEqual(new Date("2020-09-29"));
    expect.soft(held?.scheduledFor).toStrictEqual(new Date("2020-09-30"));
    expect.soft(held?.phase).toBe(boss.phase);
    const result = await readToday(goal.id);

    expect
      .soft(result.session.blocks.some((block) => readBlockPayload(block).planItemId === boss.id))
      .toBe(true);

    await expect
      .soft(getChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id }))
      .resolves.toMatchObject({
        challenge: {
          date: null,
          minutes: 15,
          questions: 10,
          status: "ready",
          topics: [{ name: library.skills[0]?.name }],
          waitReason: "lessons",
        },
        status: "ready",
      });

    await expect(
      startChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id }),
    ).resolves.toMatchObject({ reason: "lessons", status: "earlierFirst" });
  });
});
