import { prisma } from "@zoonk/db";
import { attemptFixture, learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { getRequestProgressDateContext } from "../progress/get-request-date-context";
import { getGoalPreparation } from "./get-goal-preparation";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("../progress/get-request-date-context", () => ({ getRequestProgressDateContext: vi.fn() }));

const NOW = new Date();
const DAY_MS = 86_400_000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

function mockClock() {
  vi.mocked(getRequestProgressDateContext).mockResolvedValue({
    currentDate: new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate())),
    currentInstant: NOW,
    timeZone: "UTC",
  });
}

async function setup() {
  const user = await userFixture();
  const fixture = await learnerGoalFixture({ itemsPerSkill: 3, phases: [2, 2], userId: user.id });
  mockSession(user.id);
  mockClock();

  return { ...fixture, user };
}

describe(getGoalPreparation, () => {
  it("requires a signed-in learner and hides other learners' goals", async () => {
    const { goal } = await setup();

    mockSession(null);
    await expect(getGoalPreparation(goal.id)).resolves.toStrictEqual({ status: "unauthorized" });

    const other = await userFixture();
    mockSession(other.id);
    await expect(getGoalPreparation(goal.id)).resolves.toStrictEqual({ status: "notFound" });
  });

  it("starts at zero, with no estimated score before a mock", async () => {
    const { goal } = await setup();

    const result = await getGoalPreparation(goal.id);

    expect(result.status === "ready" && result.preparation).toMatchObject({
      estimatedScore: null,
      skills: { new: 4, total: 4 },
      stage: "starting",
      status: null,
      value: 0,
      weakestAreaId: null,
    });
  });

  it("measures studied skills, unseen questions and an exam's mocks by area", async () => {
    const { chapters, goal, items, skills, user } = await setup();

    await Promise.all([
      prisma.goal.update({ data: { kind: "exam" }, where: { id: goal.id } }),
      learnerSkillFixture({
        createdAt: daysAgo(10),
        difficulty: 5,
        lastReviewedAt: daysAgo(1),
        recallDays: 1,
        reps: 3,
        skillId: skills[0]?.id ?? "",
        stability: 10,
        state: "solid",
        userId: user.id,
      }),
      learnerSkillFixture({
        createdAt: daysAgo(2),
        difficulty: 5,
        lastReviewedAt: daysAgo(2),
        reps: 1,
        skillId: skills[1]?.id ?? "",
        stability: 2,
        state: "learning",
        userId: user.id,
      }),
      ...items
        .slice(0, 6)
        .map((item, index) =>
          attemptFixture({
            answeredAt: daysAgo(index + 1),
            isCorrect: index !== 5,
            itemId: item.id,
            skillId: item.skillId,
            userId: user.id,
          }),
        ),
      learningEventFixture({
        correctAnswers: 27,
        endedAt: daysAgo(3),
        goalId: goal.id,
        incorrectAnswers: 18,
        kind: "mock",
        userId: user.id,
      }),
    ]);

    const result = await getGoalPreparation(goal.id);
    const preparation = result.status === "ready" ? result.preparation : null;

    expect(preparation?.components.coverage).toStrictEqual({
      studiedSkills: 2,
      totalSkills: 4,
      value: 0.5,
    });

    expect(preparation?.components.mastery).toMatchObject({ answered: 6, correct: 5 });

    expect(preparation?.components.mocks).toStrictEqual({
      kind: "mockExams",
      taken: 1,
      value: 0.6,
    });

    expect(preparation?.estimatedScore).toMatchObject({ mocks: 1, scale: "percent" });
    expect(preparation?.value).toBeGreaterThan(0);
    expect(preparation?.value).toBeLessThan(0.5);
    expect(preparation?.weekGain).toBeGreaterThan(0);

    expect(
      preparation?.areas.map((area) => [area.areaId, area.title, area.skills.total]),
    ).toStrictEqual([
      [chapters[0]?.id, "Chapter 1", 2],
      [chapters[1]?.id, "Chapter 2", 2],
    ]);

    expect(preparation?.weakestAreaId).toBe(chapters[0]?.id);
  });

  it("tests other goals with their weekly challenges, with no score estimate", async () => {
    const { goal, user } = await setup();

    await Promise.all([
      learningEventFixture({
        correctAnswers: 8,
        endedAt: daysAgo(2),
        goalId: goal.id,
        incorrectAnswers: 2,
        kind: "checkpoint",
        lessonKind: "weeklyChallenge",
        userId: user.id,
      }),
      // A boss is a phase's checkpoint, not the week's test.
      learningEventFixture({
        correctAnswers: 1,
        endedAt: daysAgo(1),
        goalId: goal.id,
        incorrectAnswers: 9,
        kind: "checkpoint",
        lessonKind: "boss",
        userId: user.id,
      }),
      learningEventFixture({
        correctAnswers: 0,
        endedAt: daysAgo(1),
        goalId: goal.id,
        incorrectAnswers: 10,
        kind: "mock",
        userId: user.id,
      }),
    ]);

    const result = await getGoalPreparation(goal.id);
    const preparation = result.status === "ready" ? result.preparation : null;

    expect(preparation?.components.mocks).toStrictEqual({
      kind: "weeklyChallenges",
      taken: 1,
      value: 0.8,
    });

    expect(preparation?.estimatedScore).toBeNull();
  });

  it("has no preparation for a quick explanation", async () => {
    const { goal } = await setup();
    await prisma.goal.update({ data: { kind: "explain" }, where: { id: goal.id } });

    await expect(getGoalPreparation(goal.id)).resolves.toStrictEqual({ status: "notFound" });
  });

  it("reports the plan status from scheduled items", async () => {
    const { goal, planItems } = await setup();
    const today = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate()));

    await Promise.all(
      planItems.map((item, index) =>
        prisma.planItem.update({
          data: {
            scheduledFor: new Date(today.getTime() + (index - 2) * DAY_MS),
            status: index < 3 ? "done" : "todo",
          },
          where: { id: item.id },
        }),
      ),
    );

    const result = await getGoalPreparation(goal.id);

    expect(result.status === "ready" && result.preparation.status).toStrictEqual({
      kind: "onTrack",
    });
  });
});
