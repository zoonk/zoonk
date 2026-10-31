import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockGuestSession } from "../../_test-utils/mock-session";
import { getGoalPlan } from "../../plans/get-goal-plan";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { sessionGoalFixture } from "../../sessions/_test-utils/session-goal";
import { openStudyDay } from "../../sessions/open-study-day";
import { getTodayView } from "../today/get-today-view";
import { getOnboarding } from "./get-onboarding";

/** Inject only the planner read failure; goal, answers, resume, and session persistence remain real. */
vi.mock("../../plans/get-goal-plan", () => ({
  getGoalPlan: vi.fn().mockRejectedValue(new Error("The plan's bosses didn't settle in 5 passes.")),
}));

describe("recovering a guest's failed date screen", () => {
  it("keeps the failed date step and answers, and refuses to create Today's default session", async () => {
    const user = await userFixture();

    const { goal } = await sessionGoalFixture({
      goal: { dailyMinutes: 30, kind: "exam", targetDate: new Date("2026-11-08T00:00:00Z") },
      lessons: 1,
      userId: user.id,
    });

    const details = {
      answered: ["level"],
      courseStart: { chapterId: null, dailyMinutes: 30 },
      level: "basic",
    };

    await prisma.goal.update({ data: { details }, where: { id: goal.id } });
    mockGuestSession(user.id);

    await expect(getGoalPlan(goal.id)).rejects.toThrow(
      "The plan's bosses didn't settle in 5 passes.",
    );

    const onboarding = await getOnboarding({ goalId: goal.id });
    expect(onboarding.status === "ready" && onboarding.onboarding.steps[0]).toBe("targetDate");

    await expect(getTodayView({})).resolves.toMatchObject({
      goal: { id: goal.id, kind: "exam", title: goal.title },
      status: "preparing",
    });

    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      dailyMinutes: 30,
      details,
      targetDate: goal.targetDate,
    });

    await prisma.goal.update({
      data: {
        details: {
          ...details,
          answered: ["level", "targetDate", "buddy", "placement", "schedule"],
        },
      },
      where: { id: goal.id },
    });

    const ready = await getTodayView({});
    expect(ready.status).toBe("ready");
    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);

    if (ready.status !== "ready") {
      throw new Error("Expected the recovered Today preview");
    }

    await expect(
      openStudyDay({
        goalId: goal.id,
        shownDate: toIsoDate(ready.today.session.localDate),
        timeZone: "UTC",
      }),
    ).resolves.toMatchObject({ status: "opened" });

    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(1);
  });
});
