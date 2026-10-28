import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getPlanChangedSince } from "./get-plan-changed-since";

const AFTER_READ_MS = 5000;

async function setup() {
  const user = await userFixture();
  const goal = await goalFixture({ userId: user.id });

  const [plan, planned, stopLesson, session] = await Promise.all([
    planFixture({ goalId: goal.id }),
    libraryLessonFixture({ title: "Being written" }),
    libraryLessonFixture({ title: "Today's stop" }),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
  ]);

  const [item, stop] = await Promise.all([
    planItemFixture({ lessonId: planned.id, planId: plan.id }),
    studySessionBlockFixture({ lessonId: stopLesson.id, position: 0, sessionId: session.id }),
  ]);

  mockSession(user.id);

  return {
    goal,
    item,
    plan,
    planned,
    readAt: Date.now() + AFTER_READ_MS,
    session,
    stop,
    stopLesson,
  };
}

function afterRead(readAt: number) {
  vi.setSystemTime(readAt + AFTER_READ_MS);
}

describe(getPlanChangedSince, () => {
  it("says nothing changed while nothing was written since the screen's read", async () => {
    const { goal, readAt } = await setup();

    await expect(
      getPlanChangedSince({ goalId: goal.id, since: readAt, watch: "today" }),
    ).resolves.toStrictEqual({ changed: false, status: "ready" });
  });

  it("sees a lesson in the plan written after the read", async () => {
    const { goal, planned, readAt } = await setup();

    vi.useFakeTimers({ toFake: ["Date"] });
    afterRead(readAt);
    await prisma.lesson.update({ data: { contentStatus: "completed" }, where: { id: planned.id } });
    vi.useRealTimers();

    await expect(
      getPlanChangedSince({ goalId: goal.id, since: readAt, watch: "plan" }),
    ).resolves.toStrictEqual({ changed: true, status: "ready" });
  });

  it("sees a re-plan and an item that moved after the read", async () => {
    const first = await setup();
    const second = await setup();

    vi.useFakeTimers({ toFake: ["Date"] });
    afterRead(Math.max(first.readAt, second.readAt));

    await Promise.all([
      prisma.plan.update({ data: { version: { increment: 1 } }, where: { id: first.plan.id } }),
      prisma.planItem.update({ data: { status: "done" }, where: { id: second.item.id } }),
    ]);

    vi.useRealTimers();

    mockSession(first.goal.userId);

    await expect(
      getPlanChangedSince({ goalId: first.goal.id, since: first.readAt, watch: "plan" }),
    ).resolves.toStrictEqual({ changed: true, status: "ready" });

    mockSession(second.goal.userId);

    await expect(
      getPlanChangedSince({ goalId: second.goal.id, since: second.readAt, watch: "plan" }),
    ).resolves.toStrictEqual({ changed: true, status: "ready" });
  });

  it("sees today's session when its stops change or a stop's lesson is written", async () => {
    const first = await setup();
    const second = await setup();

    vi.useFakeTimers({ toFake: ["Date"] });
    afterRead(Math.max(first.readAt, second.readAt));

    const lesson = await libraryLessonFixture({ title: "Landed" });

    await Promise.all([
      studySessionBlockFixture({ lessonId: lesson.id, position: 1, sessionId: first.session.id }),
      prisma.lesson.update({
        data: { contentStatus: "completed" },
        where: { id: second.stopLesson.id },
      }),
    ]);

    vi.useRealTimers();

    mockSession(first.goal.userId);

    await expect(
      getPlanChangedSince({ goalId: first.goal.id, since: first.readAt, watch: "today" }),
    ).resolves.toStrictEqual({ changed: true, status: "ready" });

    mockSession(second.goal.userId);

    await expect(
      getPlanChangedSince({ goalId: second.goal.id, since: second.readAt, watch: "today" }),
    ).resolves.toStrictEqual({ changed: true, status: "ready" });
  });

  it("leaves today's session out when watching only the plan", async () => {
    const { goal, readAt, session } = await setup();

    vi.useFakeTimers({ toFake: ["Date"] });
    afterRead(readAt);
    const lesson = await libraryLessonFixture({ title: "Landed" });
    await studySessionBlockFixture({ lessonId: lesson.id, position: 1, sessionId: session.id });
    vi.useRealTimers();

    await expect(
      getPlanChangedSince({ goalId: goal.id, since: readAt, watch: "plan" }),
    ).resolves.toStrictEqual({ changed: false, status: "ready" });

    await expect(
      getPlanChangedSince({ goalId: goal.id, since: readAt, watch: "today" }),
    ).resolves.toStrictEqual({ changed: true, status: "ready" });
  });

  it("never answers about another learner's goal", async () => {
    const { goal, readAt } = await setup();
    const stranger = await userFixture();
    mockSession(stranger.id);

    await expect(
      getPlanChangedSince({ goalId: goal.id, since: readAt, watch: "today" }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });

  it("refuses a visitor without a session", async () => {
    const { goal, readAt } = await setup();
    mockSession(null);

    await expect(
      getPlanChangedSince({ goalId: goal.id, since: readAt, watch: "today" }),
    ).resolves.toStrictEqual({ status: "unauthorized" });
  });
});
