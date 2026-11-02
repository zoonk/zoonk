import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { planChangeFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY, toUTCMidnight } from "@zoonk/utils/date";
import { beforeEach, describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { planLibraryFixture, unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { createGoalPlan } from "../plans/create-goal-plan";
import { parseLessonQuestionContextSnapshot } from "./_utils/context-snapshot-schema";
import { createLessonQuestion } from "./create-lesson-question";

async function learnerBehind({ active = true }: { active?: boolean } = {}) {
  const user = await userFixture();
  const library = await planLibraryFixture({ skills: [{ area: "Physics", lessons: 4 }] });
  const { goal } = await unplannedGoalFixture({ timezone: "UTC", userId: user.id });

  await createGoalPlan({ goalId: goal.id, graph: library.graph });

  const lessons = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: { kind: "lesson", plan: { goalId: goal.id } },
  });

  const carried = lessons.slice(0, 2);
  const plan = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

  await Promise.all([
    planChangeFixture({
      kind: "missedDays",
      payload: { carriedItemIds: carried.map((item) => item.id), days: 1, source: "system" },
      planId: plan.id,
      status: "applied",
    }),
    learningProfileFixture({ activeGoalId: active ? goal.id : null, userId: user.id }),
  ]);

  return { carried, goal, user };
}

async function askAboutPlan({ goalId, userId }: { goalId: string; userId: string }) {
  mockSession(userId);

  const created = await createLessonQuestion({
    input: {
      context: { kind: "plan" },
      question: "Why am I behind? Which lesson first?",
      requestId: randomUUID(),
    },
    target: { goalId, kind: "plan" },
  });

  if (created.status !== "created") {
    throw new Error(`Expected a created question, received ${created.status}`);
  }

  const stored = await prisma.lessonQuestion.findUniqueOrThrow({
    where: { id: created.question.id },
  });

  return { raw: JSON.stringify(stored.contextSnapshot), snapshot: stored.contextSnapshot };
}

async function readTodayBlocks(goalId: string) {
  const blocks = await prisma.studySessionBlock.findMany({
    where: { kind: "learn", session: { goalId } },
  });

  return new Map(blocks.map((block) => [block.lessonId, block.id]));
}

function readPlanSnapshot(value: unknown) {
  const snapshot = parseLessonQuestionContextSnapshot(value);

  if (!("today" in snapshot)) {
    throw new Error(`Expected a plan snapshot, received ${snapshot.scope.kind}`);
  }

  return snapshot;
}

describe("the plan the buddy reads", () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("names the lessons earlier days left, with where they open, and only the learner's own", async () => {
    const [learner, other] = await Promise.all([learnerBehind(), learnerBehind()]);

    const { raw, snapshot } = await askAboutPlan({
      goalId: learner.goal.id,
      userId: learner.user.id,
    });

    const plan = readPlanSnapshot(snapshot);

    expect(plan.selectedGoal).toBe(true);

    const blocks = await readTodayBlocks(learner.goal.id);

    expect(plan.catchUp).toStrictEqual({
      lessons: learner.carried.map((item) => ({
        inToday: true,
        link: { blockId: blocks.get(item.lessonId), kind: "block" },
        title: item.titleSnapshot,
      })),
      offeredToday: false,
      total: 2,
    });

    for (const item of other.carried) {
      expect(raw).not.toContain(item.titleSnapshot);
      expect(raw).not.toContain(item.id);
    }
  });

  it("links a lesson earlier days left to today's block once the day holds it", async () => {
    const { carried, goal, user } = await learnerBehind();
    const [first] = carried;

    if (!first) {
      throw new Error("Expected a carried lesson");
    }

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: toUTCMidnight(new Date()),
      userId: user.id,
    });

    const block = await studySessionBlockFixture({
      kind: "learn",
      lessonId: first.lessonId,
      payload: { planItemId: first.id },
      position: 0,
      sessionId: session.id,
    });

    const { snapshot } = await askAboutPlan({ goalId: goal.id, userId: user.id });
    const plan = readPlanSnapshot(snapshot);
    const blockLink = { blockId: block.id, kind: "block" };

    expect(plan.catchUp?.lessons[0]).toStrictEqual({
      inToday: true,
      link: blockLink,
      title: first.titleSnapshot,
    });

    expect(plan.today).toMatchObject({
      items: [{ catchUp: true, link: blockLink, title: first.titleSnapshot }],
      source: "session",
    });
  });

  it("finds a lesson earlier days left in a welcome back's day, whose view says nothing about catching up", async () => {
    const { carried, goal, user } = await learnerBehind();
    const [first] = carried;

    if (!first) {
      throw new Error("Expected a carried lesson");
    }

    const session = await studySessionFixture({
      freshStart: "welcomeBack",
      goalId: goal.id,
      localDate: toUTCMidnight(new Date()),
      userId: user.id,
    });

    const block = await studySessionBlockFixture({
      kind: "learn",
      lessonId: first.lessonId,
      payload: { planItemId: first.id },
      position: 0,
      sessionId: session.id,
    });

    const { snapshot } = await askAboutPlan({ goalId: goal.id, userId: user.id });
    const plan = readPlanSnapshot(snapshot);
    const blockLink = { blockId: block.id, kind: "block" };

    expect(plan.catchUp?.lessons[0]).toStrictEqual({
      inToday: true,
      link: blockLink,
      title: first.titleSnapshot,
    });

    expect(plan.today).toMatchObject({
      items: [{ catchUp: true, link: blockLink, title: first.titleSnapshot }],
    });

    expect(plan.catchUp?.lessons[1]).toStrictEqual({
      inToday: false,
      link: null,
      title: carried[1]?.titleSnapshot,
    });
  });

  it("names the week's challenge ahead by its kind, linked to its page", async () => {
    const { goal, user } = await learnerBehind();
    const { id: planId } = await prisma.plan.findUniqueOrThrow({ where: { goalId: goal.id } });

    await planItemFixture({
      kind: "checkpoint",
      planId,
      position: 1000,
      scheduledFor: toUTCMidnight(new Date(Date.now() + 3 * MS_PER_DAY)),
    });

    const next = await prisma.planItem.findFirstOrThrow({
      orderBy: [{ scheduledFor: "asc" }, { position: "asc" }],
      where: { kind: "checkpoint", planId, scheduledFor: { not: null }, status: "todo" },
    });

    const { snapshot } = await askAboutPlan({ goalId: goal.id, userId: user.id });

    expect(readPlanSnapshot(snapshot).challenges).toContainEqual({
      date: next.scheduledFor?.toISOString().slice(0, 10),
      kind: "weekly",
      link: { kind: "challenge", planItemId: next.id },
      locked: false,
      when: "date",
    });
  });

  it("links nothing that would open another goal's day when this goal isn't the one open", async () => {
    const { carried, goal, user } = await learnerBehind({ active: false });

    const open = await unplannedGoalFixture({ userId: user.id });

    await prisma.userLearningProfile.update({
      data: { activeGoalId: open.goal.id },
      where: { userId: user.id },
    });

    const { snapshot } = await askAboutPlan({ goalId: goal.id, userId: user.id });
    const plan = readPlanSnapshot(snapshot);

    expect(plan.selectedGoal).toBeUndefined();

    expect(plan.catchUp?.lessons).toStrictEqual(
      carried.map((item) => ({ inToday: false, link: null, title: item.titleSnapshot })),
    );
  });
});
