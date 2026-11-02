import { prisma } from "@zoonk/db";
import { goalFixture, layOutPlanFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { observeDatabaseQueries } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { mockSession } from "../../_test-utils/mock-session";
import { getMockOptions } from "../../exams/mocks/get-mock-options";
import { learnerGoalFixture } from "../../learner/_test-utils/learner-goal";
import { answerPlacementQuestion } from "../../learner/placement/answer-placement-question";
import { finishGoalPlacement } from "../../learner/placement/finish-goal-placement";
import { toPlanChangePayload } from "../../plans/_utils/plan-change-payload";
import { saveProposalPreviews } from "../../plans/_utils/write-plan";
import { SESSION_NOW, sessionGoalFixture } from "../../sessions/_test-utils/session-goal";
import { openStudyDay } from "../../sessions/open-study-day";
import { answerOnboardingQuestion } from "./answer-onboarding-question";

describe("onboarding transaction queries", () => {
  it("loads exam placement options without overlapping snapshot reads", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ kind: "exam", timezone: "UTC", userId: user.id });
    mockSession(user.id);

    const { overlaps, result } = await observeDatabaseQueries(() =>
      getMockOptions({ goalId: goal.id }),
    );

    expect(result.status).toBe("ready");
    expect(overlaps).toStrictEqual([]);
  });

  it("refreshes an existing study day when a learner returns to onboarding and changes their schedule", async () => {
    freezeClock();
    vi.setSystemTime(SESSION_NOW);
    const user = await userFixture();
    const { goal, plan } = await sessionGoalFixture({ userId: user.id });
    await layOutPlanFixture(plan.id);
    mockSession(user.id);

    await expect(
      openStudyDay({ goalId: goal.id, shownDate: "2026-09-30", timeZone: "UTC" }),
    ).resolves.toMatchObject({ status: "opened" });

    const { overlaps, result } = await observeDatabaseQueries(() =>
      answerOnboardingQuestion({
        goalId: goal.id,
        input: { dailyMinutes: 20, question: "schedule", timeZone: "UTC" },
      }),
    );

    expect(result).toMatchObject({ status: "saved" });
    expect(overlaps).toStrictEqual([]);

    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(1);
  });

  it("records a placement answer without overlapping queries on one connection", async () => {
    const user = await userFixture();
    const { goal, skills } = await learnerGoalFixture({ phases: [2], userId: user.id });
    const item = await itemFixture({ content: choiceItemContent(), skillId: skills[0]!.id });
    mockSession(user.id);

    const { overlaps, result } = await observeDatabaseQueries(() =>
      answerPlacementQuestion({
        goalId: goal.id,
        input: { answer: { selectedIndex: 0 }, durationMs: 3000, itemId: item.id },
      }),
    );

    expect(result).toMatchObject({ isCorrect: true, status: "ready" });

    await expect(
      prisma.attempt.count({ where: { itemId: item.id, userId: user.id } }),
    ).resolves.toBe(1);

    expect(overlaps).toStrictEqual([]);
  });

  it("saves a schedule and finishes placement without overlapping transaction queries", async () => {
    const user = await userFixture();

    const { goal, items, skills } = await learnerGoalFixture({ phases: [2], userId: user.id });

    mockSession(user.id);
    const skill = skills[0]!;

    await Promise.all(
      items
        .filter((item) => item.skillId === skill.id)
        .map((item) =>
          answerPlacementQuestion({
            goalId: goal.id,
            input: { answer: { selectedIndex: 0 }, durationMs: 3000, itemId: item.id },
          }),
        ),
    );

    const { overlaps, result } = await observeDatabaseQueries(async () => {
      const saved = await answerOnboardingQuestion({
        goalId: goal.id,
        input: { dailyMinutes: 20, question: "schedule", timeZone: "UTC" },
      });

      await prisma.planItem.deleteMany({
        where: { lesson: { skills: { some: { skillId: skill.id } } }, plan: { goalId: goal.id } },
      });

      const placement = await finishGoalPlacement({
        goalId: goal.id,
        input: { fromScratch: false },
      });

      return { placement, saved };
    });

    expect(result).toMatchObject({ placement: { status: "ready" }, saved: { status: "saved" } });
    expect(overlaps).toStrictEqual([]);

    await expect(
      prisma.planItem.findFirst({ where: { plan: { goalId: goal.id }, skillId: skill.id } }),
    ).resolves.toMatchObject({ status: "testedOut" });
  });

  it("updates all waiting proposal previews in one transaction without query overlap", async () => {
    const user = await userFixture();
    const { plan } = await learnerGoalFixture({ phases: [1], userId: user.id });

    const changes = await prisma.planChange.createManyAndReturn({
      data: Array.from({ length: 3 }, () => ({
        kind: "edited" as const,
        payload: {},
        planId: plan.id,
        reason: "Preview",
        status: "proposed" as const,
      })),
    });

    const payload = toPlanChangePayload({ versionAfter: 2 });
    const previews = changes.map((change) => ({ id: change.id, payload }));

    const { overlaps } = await observeDatabaseQueries(() =>
      prisma.$transaction((tx) => saveProposalPreviews({ previews, tx })),
    );

    expect(overlaps).toStrictEqual([]);

    const stored = await prisma.planChange.findMany({
      where: { id: { in: changes.map((change) => change.id) } },
    });

    expect(stored).toHaveLength(changes.length);
    expect(stored.map((change) => change.payload)).toStrictEqual(changes.map(() => payload));
  });
});
