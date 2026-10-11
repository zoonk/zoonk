import { prisma } from "@zoonk/db";
import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getDailyReviewCap } from "../learner/review-load";
import { getTodayStudySession } from "./_test-utils/open-today";
import {
  DAY_MS,
  SESSION_NOW,
  daysAgo,
  dueSkillFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { readBlockPayload } from "./block-payload";
import { getLightMinutes } from "./fresh-start";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const DAILY_MINUTES = 20;

/** An hour a day: a return's light day is about 25 minutes, less than twenty due skills take. */
const RETURN_DAILY_MINUTES = 60;

/**
 * A free exam plan ten days in, past its first week: new lessons and practice are Plus, reviews
 * stay free. Ten skills studied, one lesson each, three questions each, the last study yesterday,
 * so today is an ordinary day, not a return.
 */
async function pastTrialFixture() {
  const user = await userFixture();

  const fixture = await sessionGoalFixture({
    goal: { createdAt: daysAgo(10), dailyMinutes: DAILY_MINUTES, kind: "exam" },
    lessons: 10,
    userId: user.id,
  });

  await Promise.all([
    prisma.planItem.updateMany({
      data: { completedAt: daysAgo(3), status: "done" },
      where: { id: { in: fixture.planItems.map((item) => item.id) } },
    }),
    dailyProgressFixtureMany([{ date: daysAgo(1), timeSpentSeconds: 1200, userId: user.id }]),
  ]);

  return { ...fixture, user };
}

/** Today's blocks for the learner, with their payloads and the view the apps read. */
async function openToday({ goalId, userId }: { goalId: string; userId: string }) {
  mockSession(userId);
  const today = await getTodayStudySession({ goalId });

  if (today.status !== "ready") {
    throw new Error(`Expected a session, got ${today.status}`);
  }

  const rows = await prisma.studySessionBlock.findMany({
    orderBy: { position: "asc" },
    where: { sessionId: today.session.id },
  });

  return {
    blocks: rows.map((block) => ({ kind: block.kind, payload: readBlockPayload(block) })),
    views: today.session.blocks,
  };
}

describe("a day nothing but reviews can fill", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("gives the reviews the whole session, up to the daily review cap", async () => {
    const { goal, skills, user } = await pastTrialFixture();

    await Promise.all(
      skills.map((skill) => dueSkillFixture({ skillId: skill.id, userId: user.id })),
    );

    const { blocks } = await openToday({ goalId: goal.id, userId: user.id });

    expect(blocks.map((block) => block.kind)).toStrictEqual(["review"]);

    expect(blocks[0]?.payload.capsules.flatMap((capsule) => capsule.skillIds)).toHaveLength(
      getDailyReviewCap({ dailyMinutes: DAILY_MINUTES }),
    );
  });

  it("is never empty: with nothing due, a short review of the weakest studied topics, said as such", async () => {
    const { goal, skills, user } = await pastTrialFixture();

    // Nothing is due for days; the first skill fades fastest.
    await Promise.all(
      skills.map((skill, index) =>
        learnerSkillFixture({
          difficulty: 5,
          due: new Date(SESSION_NOW.getTime() + (index + 3) * DAY_MS),
          lastReviewedAt: daysAgo(2),
          reps: 2,
          skillId: skill.id,
          stability: index + 5,
          state: "learning",
          userId: user.id,
        }),
      ),
    );

    const { blocks, views } = await openToday({ goalId: goal.id, userId: user.id });
    const [review] = blocks;
    const reviewed = review?.payload.capsules.flatMap((capsule) => capsule.skillIds) ?? [];

    expect(blocks.map((block) => block.kind)).toStrictEqual(["review"]);
    expect(review?.payload.weakest).toBe(true);
    expect(views[0]?.weakest).toBe(true);
    expect(reviewed[0]).toBe(skills[0]?.id);
    expect(reviewed.length).toBeLessThan(skills.length);
  });

  it("keeps a day with lessons as it was when nothing is due", async () => {
    const user = await userFixture();

    const { goal, skills } = await sessionGoalFixture({
      goal: { dailyMinutes: DAILY_MINUTES },
      userId: user.id,
    });

    await learnerSkillFixture({
      difficulty: 5,
      due: new Date(SESSION_NOW.getTime() + 5 * DAY_MS),
      lastReviewedAt: daysAgo(2),
      reps: 2,
      skillId: skills[0]?.id ?? "",
      stability: 5,
      state: "learning",
      userId: user.id,
    });

    const { blocks } = await openToday({ goalId: goal.id, userId: user.id });

    expect(blocks.map((block) => block.kind)).not.toContain("review");
    expect(blocks.some((block) => block.payload.weakest)).toBe(false);
  });

  // Rafaela, free and back after 12 days, got a 52-minute review on a "lighter" day: reviews fill
  // the learner's own time for the day, the light day's on a return, and never more.
  it("fills a return's light day with reviews only up to its minutes", async () => {
    const user = await userFixture();

    const { goal, planItems, skills } = await sessionGoalFixture({
      goal: { createdAt: daysAgo(10), dailyMinutes: RETURN_DAILY_MINUTES, kind: "exam" },
      lessons: 20,
      userId: user.id,
    });

    await Promise.all([
      prisma.planItem.updateMany({
        data: { completedAt: daysAgo(6), status: "done" },
        where: { id: { in: planItems.map((item) => item.id) } },
      }),
      dailyProgressFixtureMany([{ date: daysAgo(5), timeSpentSeconds: 1200, userId: user.id }]),
      ...skills.map((skill) => dueSkillFixture({ skillId: skill.id, userId: user.id })),
    ]);

    const { views } = await openToday({ goalId: goal.id, userId: user.id });
    const minutes = views.reduce((sum, block) => sum + block.estimatedMinutes, 0);

    expect(views.map((block) => block.kind)).toStrictEqual(["review"]);
    expect(minutes).toBeLessThanOrEqual(getLightMinutes(RETURN_DAILY_MINUTES));
    expect(minutes).toBeGreaterThan(getLightMinutes(RETURN_DAILY_MINUTES) / 2);
  });
});
