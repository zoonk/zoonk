import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import * as logger from "@zoonk/utils/logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { pickSpeculativeLessons } from "../../lookahead/speculative-lessons";
import { markPlanInputsUntil } from "../../plans/_test-utils/mark-plan-inputs";
import { openStudyDay } from "../../sessions/open-study-day";
import { answerOnboardingQuestion } from "../../view-models/onboarding/answer-onboarding-question";
import { mockDecision, mockSearchTerms, uniqueWord } from "../identity/_test-utils/identity-mocks";
import {
  WAITING_START,
  outlineSkill,
  plannedLessons,
  waitingGoal,
} from "./_test-utils/waiting-goals";
import {
  listGoalsWaitingOnSkills,
  replanGoalsWaitingOnSkills,
  replanWaitingGoal,
} from "./replan-waiting-goals";

const POPULAR_BAND_GOALS = 12;

describe(replanGoalsWaitingOnSkills, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(WAITING_START);
    mockSearchTerms([uniqueWord()]);
    mockDecision(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("preserves requested goal order when listing waiting goals", async () => {
    const user = await userFixture();
    const first = await goalFixture({ userId: user.id });
    const second = await goalFixture({ userId: user.id });

    for (const goalIds of [
      [first.id, second.id],
      [second.id, first.id],
    ]) {
      // oxlint-disable-next-line no-await-in-loop -- Both orders must be preserved for the same pair of goals.
      const waiting = await listGoalsWaitingOnSkills({ goalIds, skillIds: [] });
      expect(waiting).toStrictEqual(goalIds);
    }
  });

  it("reports a goal whose plan kept changing, for later, and re-plans the others", async () => {
    const skill = await skillFixture();
    const [busy, other] = await Promise.all([waitingGoal(skill), waitingGoal(skill)]);
    const lessonIds = await outlineSkill(skill);
    const error = vi.spyOn(logger, "logError");
    const stop = new AbortController();
    const marking = markPlanInputsUntil({ planId: busy.plan.id, signal: stop.signal });
    const replanning = replanGoalsWaitingOnSkills({ skillIds: [skill.id] });

    await Promise.allSettled([replanning.finally(() => stop.abort()), marking]);

    await expect(marking).resolves.toBeGreaterThan(0);

    await expect(replanning).resolves.toStrictEqual({
      failedGoalIds: [busy.goal.id],
      goalIds: [other.goal.id],
    });

    expect(error).toHaveBeenCalledExactlyOnceWith(
      `Could not re-plan goal ${busy.goal.id} with the lessons it waited for.`,
      expect.objectContaining({ name: "PlanConflictError" }),
    );

    await expect(plannedLessons(busy.plan.id)).resolves.toStrictEqual([skill.id]);
    await expect(plannedLessons(other.plan.id)).resolves.toStrictEqual(lessonIds);

    await replanWaitingGoal(busy.goal.id);
    await expect(plannedLessons(busy.plan.id)).resolves.toStrictEqual(lessonIds);
  });

  it("re-plans every goal waiting on a popular course's band", async () => {
    const skill = await skillFixture();

    const waiting = await Promise.all(
      Array.from({ length: POPULAR_BAND_GOALS }, () => waitingGoal(skill)),
    );

    const lessonIds = await outlineSkill(skill);
    const replanned = await replanGoalsWaitingOnSkills({ skillIds: [skill.id] });

    expect(replanned.failedGoalIds).toStrictEqual([]);

    expect(replanned.goalIds.toSorted()).toStrictEqual(
      waiting.map(({ goal }) => goal.id).toSorted(),
    );

    const planned = await Promise.all(waiting.map(({ plan }) => plannedLessons(plan.id)));
    expect(planned).toStrictEqual(waiting.map(() => lessonIds));
  });

  it("leaves a learner still answering onboarding to re-plan with the answer", async () => {
    const skill = await skillFixture();
    const { goal, plan } = await waitingGoal(skill);

    await prisma.goal.update({
      data: { details: { answered: ["purpose", "level", "targetDate", "buddy", "placement"] } },
      where: { id: goal.id },
    });

    const lessons = await outlineSkill(skill);
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    await replanWaitingGoal(goal.id);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toStrictEqual(
      before,
    );

    await expect(plannedLessons(plan.id)).resolves.toStrictEqual([skill.id]);
    mockSession(goal.userId);

    await expect(
      answerOnboardingQuestion({
        goalId: goal.id,
        input: { dailyMinutes: 25, question: "schedule" },
      }),
    ).resolves.toMatchObject({ status: "saved" });

    await expect(plannedLessons(plan.id)).resolves.toStrictEqual(lessons);
  });

  it("refreshes a completed setup before the learner opens the first study day", async () => {
    const skill = await skillFixture();
    const { goal, plan } = await waitingGoal(skill);
    await prisma.studySession.deleteMany({ where: { goalId: goal.id } });
    const lessons = await outlineSkill(skill);
    const before = await prisma.plan.findUniqueOrThrow({ where: { id: plan.id } });
    await replanWaitingGoal(goal.id);

    await expect(plannedLessons(plan.id)).resolves.toStrictEqual(lessons);

    await expect(prisma.plan.findUniqueOrThrow({ where: { id: plan.id } })).resolves.toMatchObject({
      version: before.version + 1,
    });

    mockSession(goal.userId);

    await expect(
      openStudyDay({
        goalId: goal.id,
        shownDate: WAITING_START.toISOString().slice(0, 10),
        timeZone: "UTC",
      }),
    ).resolves.toMatchObject({ status: "opened" });

    await expect(plannedLessons(plan.id)).resolves.toStrictEqual(lessons);
  });

  it("picks newly published lessons in memory while onboarding still owns the saved plan", async () => {
    const skill = await skillFixture();
    const { goal, plan } = await waitingGoal(skill);
    await prisma.goal.update({ data: { details: {} }, where: { id: goal.id } });
    const lessons = await outlineSkill(skill);

    const before = await prisma.plan.findUniqueOrThrow({
      include: { items: true },
      where: { id: plan.id },
    });

    await expect(
      pickSpeculativeLessons({ count: 2, goalId: goal.id, ownLevel: null }),
    ).resolves.toStrictEqual([lessons.slice(0, 2)]);

    await expect(
      prisma.plan.findUniqueOrThrow({ include: { items: true }, where: { id: plan.id } }),
    ).resolves.toStrictEqual(before);
  });
});
