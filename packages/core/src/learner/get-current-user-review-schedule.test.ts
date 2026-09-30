import { prisma } from "@zoonk/db";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "./_test-utils/learner-goal";
import { getCurrentUserReviewSchedule } from "./get-current-user-review-schedule";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

const DAY_MS = 86_400_000;

function overdue(daysAgo: number) {
  return {
    difficulty: 5,
    due: new Date(Date.now() - daysAgo * DAY_MS),
    lastReviewedAt: new Date(Date.now() - (daysAgo + 3) * DAY_MS),
    reps: 2,
    stability: 3,
    state: "learning" as const,
  };
}

describe(getCurrentUserReviewSchedule, () => {
  it("requires a signed-in learner", async () => {
    mockSession(null);

    await expect(getCurrentUserReviewSchedule({})).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });

  it("caps today's reviews by the goal's daily time and spreads the rest over the next days", async () => {
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [5],
      userId: user.id,
    });

    mockSession(user.id);

    await Promise.all(
      skills.map((skill, index) =>
        learnerSkillFixture({ ...overdue(index + 1), skillId: skill.id, userId: user.id }),
      ),
    );

    // 5 minutes a day holds 3 reviews.
    await prisma.goal.update({ data: { dailyMinutes: 5 }, where: { id: goal.id } });

    const result = await getCurrentUserReviewSchedule({ goalId: goal.id, timeZone: "UTC" });

    expect(result.status).toBe("ready");
    expect(result.status === "ready" && result.schedule.cap).toBe(3);

    // The longest overdue skills have the lowest chance of recall, so they come first.
    expect(
      result.status === "ready" && result.schedule.dueToday.map((review) => review.skillId),
    ).toStrictEqual([skills[4], skills[3], skills[2]].map((skill) => skill?.id));

    expect(
      result.status === "ready" && result.schedule.forecast.slice(0, 3).map((day) => day.reviews),
    ).toStrictEqual([3, 2, 0]);
  });

  it("hides another learner's goal", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const { goal } = await learnerGoalFixture({ itemsPerSkill: 0, phases: [1], userId: owner.id });
    mockSession(other.id);

    await expect(getCurrentUserReviewSchedule({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });
});
