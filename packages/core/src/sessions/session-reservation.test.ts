import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { listPlanOutlineNeeds } from "../lookahead/plan-outline-needs";
import { keepPaceOwn } from "../plans/_test-utils/keep-pace-own";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { getTodayView } from "../view-models/today/get-today-view";
import { openTodayView } from "./_test-utils/open-today-view";
import { settleSessionDay } from "./_utils/settle-session-day";

const NOW = new Date("2026-09-30T12:00:00Z");

async function setup() {
  freezeClock();
  vi.setSystemTime(NOW);
  await keepPaceOwn();

  const [user, course, library] = await Promise.all([
    userFixture(),
    courseFixture({ outlineStatus: "running" }),
    planLibraryFixture({ skills: [{ lessons: 2 }, { lessons: 0, size: 20 }] }),
  ]);

  const { goal, plan } = await unplannedGoalFixture({
    dailyMinutes: 30,
    details: { placementDeclined: true },
    primaryCourseId: course.id,
    settings: { startDate: "2026-09-30" },
    timezone: "UTC",
    userId: user.id,
  });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });
  mockSession(user.id);
  return { course, goal, library, plan, user };
}

describe("the day's lesson reservation", () => {
  it("keeps a day open after every written block finishes, including when its outline goes stale", async () => {
    const { course, goal, user } = await setup();
    const opened = await openTodayView({ goalId: goal.id, timeZone: "UTC" });
    const sessionId = opened.today.session.id;

    await Promise.all([
      prisma.studySessionBlock.updateMany({
        data: { completedAt: NOW, status: "completed" },
        where: { sessionId },
      }),
      prisma.planItem.updateMany({
        data: { completedAt: NOW, status: "done" },
        where: {
          lessonId: { not: null },
          plan: { goalId: goal.id },
          scheduledFor: { lte: new Date("2026-09-30") },
        },
      }),
    ]);

    const settle = () => settleSessionDay({ sessionId, timeZone: "UTC", userId: user.id });
    await expect(settle()).resolves.toMatchObject({ sessionCompleted: false });

    await expect(getTodayView({ goalId: goal.id, timeZone: "UTC" })).resolves.toMatchObject({
      today: { session: { lessonsComing: true, minutes: { left: 24 }, state: "waiting" } },
    });

    await prisma.course.update({
      data: { updatedAt: new Date(NOW.getTime() - 20 * 60_000) },
      where: { id: course.id },
    });

    await expect(settle()).resolves.toMatchObject({ sessionCompleted: false });

    await expect(getTodayView({ goalId: goal.id, timeZone: "UTC" })).resolves.toMatchObject({
      today: {
        session: {
          lessonsComing: false,
          lessonsToPrepare: true,
          minutes: { left: 24 },
          state: "waiting",
        },
      },
    });

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: sessionId } }),
    ).resolves.toMatchObject({ endedAt: null, plannedMinutes: 30 });
  });

  it("keeps the same outline targets when the first day receives its full lesson share", async () => {
    const { goal, library, plan } = await setup();
    const firstDay = await listPlanOutlineNeeds({ days: 14, goalId: goal.id });

    await prisma.plan.update({
      data: { settings: { startDate: "2026-09-29" } },
      where: { id: plan.id },
    });

    await createGoalPlan({ goalId: goal.id, graph: library.graph });
    const ordinaryShare = await listPlanOutlineNeeds({ days: 14, goalId: goal.id });
    expect(firstDay).not.toHaveLength(0);
    expect(firstDay).toStrictEqual(ordinaryShare);
  });
});
