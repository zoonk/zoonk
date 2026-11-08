import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import * as logger from "@zoonk/utils/logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listOwed } from "../../_test-utils/follow-ups";
import { mockGuestSession, mockSession } from "../../_test-utils/mock-session";
import { markPlansChanged } from "../../learner/_utils/mark-learner-changed";
import { askForLessons } from "../../lookahead/lessons-ask";
import { OUTLINE_STALE_AFTER_MS } from "../../lookahead/outline-ahead";
import { pickSpeculativeLessons } from "../../lookahead/speculative-lessons";
import * as planToken from "../../plans/_utils/plan-token";
import { openStudyDay } from "../../sessions/open-study-day";
import { answerOnboardingQuestion } from "../../view-models/onboarding/answer-onboarding-question";
import { getTodayView } from "../../view-models/today/get-today-view";
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

function markPlanAfterRead({ goalId, planId }: { goalId: string; planId: string }) {
  const load = planToken.loadPlanAtToken;

  return vi.spyOn(planToken, "loadPlanAtToken").mockImplementation(async (id, options) => {
    const context = await load(id, options);

    if (id === goalId) {
      await prisma.$transaction((tx) => markPlansChanged(tx, { planIds: [planId] }));
    }

    return context;
  });
}

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

  it("reports a goal whose plan changed while it re-planned, for later, and re-plans the others", async () => {
    const skill = await skillFixture();
    const [busy, other] = await Promise.all([waitingGoal(skill), waitingGoal(skill)]);
    const lessonIds = await outlineSkill(skill);
    const error = vi.spyOn(logger, "logError");
    const reads = markPlanAfterRead({ goalId: busy.goal.id, planId: busy.plan.id });

    await expect(replanGoalsWaitingOnSkills({ skillIds: [skill.id] })).resolves.toStrictEqual({
      failedGoalIds: [busy.goal.id],
      goalIds: [other.goal.id],
    });

    expect(error).toHaveBeenCalledExactlyOnceWith(
      `Could not re-plan goal ${busy.goal.id} with the lessons it waited for.`,
      expect.objectContaining({ name: "PlanConflictError" }),
    );

    await expect(plannedLessons(busy.plan.id)).resolves.toStrictEqual([skill.id]);
    await expect(plannedLessons(other.plan.id)).resolves.toStrictEqual(lessonIds);

    reads.mockRestore();
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

  it("writes the lessons a learner asked for once the outline they waited on brings them in", async () => {
    const skill = await skillFixture();

    const [asked, stale, idle] = await Promise.all([
      waitingGoal(skill),
      waitingGoal(skill),
      waitingGoal(skill),
    ]);

    const [askedAt] = await Promise.all([
      askForLessons({ goalId: asked.goal.id }),
      askForLessons({
        goalId: stale.goal.id,
        now: new Date(WAITING_START.getTime() - OUTLINE_STALE_AFTER_MS - 1),
      }),
    ]);

    const [first] = await outlineSkill(skill);
    await replanGoalsWaitingOnSkills({ skillIds: [skill.id] });

    await expect(listOwed(asked.goal.userId)).resolves.toStrictEqual([
      {
        input: { goalId: asked.goal.id, lessonsAskedAt: askedAt },
        key: asked.goal.id,
        kind: "prepareGoalLessons",
      },
      { input: { lessonId: first }, key: first, kind: "writeLesson" },
    ]);

    await expect(listOwed(stale.goal.userId)).resolves.toStrictEqual([]);
    await expect(listOwed(idle.goal.userId)).resolves.toStrictEqual([]);
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

  it.each(["running", "completed"] as const)(
    "shows landed lessons without a coming row before a guest starts Today (%s outline)",
    async (outlineStatus) => {
      const skill = await skillFixture();
      const { goal } = await waitingGoal(skill);
      const course = await courseFixture({ outlineStatus: "running" });

      await Promise.all([
        prisma.goal.update({ data: { primaryCourseId: course.id }, where: { id: goal.id } }),
        prisma.user.update({ data: { isAnonymous: true }, where: { id: goal.userId } }),
        learningProfileFixture({ activeGoalId: goal.id, userId: goal.userId }),
      ]);

      mockGuestSession(goal.userId);
      const before = await getTodayView({ goalId: goal.id, timeZone: "UTC" });

      expect(before.status === "ready" && before.today.session).toMatchObject({
        emptyDay: "lessonsComing",
        status: "unstarted",
      });

      const lessons = await outlineSkill(skill);
      await replanGoalsWaitingOnSkills({ goalIds: [goal.id], skillIds: [skill.id] });
      await prisma.course.update({ data: { outlineStatus }, where: { id: course.id } });
      const after = await getTodayView({ goalId: goal.id, timeZone: "UTC" });
      const day = after.status === "ready" ? after.today.session : null;

      expect(day).toMatchObject({
        emptyDay: null,
        lessonsComing: false,
        lessonsToPrepare: false,
        status: "unstarted",
      });

      expect(day?.blocks.some((block) => block.lessonId && lessons.includes(block.lessonId))).toBe(
        true,
      );

      await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);
    },
  );

  it("picks newly published lessons in memory while onboarding still owns the saved plan", async () => {
    const skill = await skillFixture();
    const { goal, plan } = await waitingGoal(skill);
    await prisma.goal.update({ data: { details: {} }, where: { id: goal.id } });
    const lessons = await outlineSkill(skill);

    const before = await prisma.plan.findUniqueOrThrow({
      include: { items: { orderBy: { position: "asc" } } },
      where: { id: plan.id },
    });

    await expect(
      pickSpeculativeLessons({ count: 2, goalId: goal.id, ownLevel: null }),
    ).resolves.toStrictEqual([lessons.slice(0, 2)]);

    await expect(
      prisma.plan.findUniqueOrThrow({
        include: { items: { orderBy: { position: "asc" } } },
        where: { id: plan.id },
      }),
    ).resolves.toStrictEqual(before);
  });
});
