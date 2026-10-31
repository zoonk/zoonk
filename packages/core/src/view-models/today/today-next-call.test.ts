import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { findNextCall } from "../../sessions/day-block";
import { getTodayView } from "./get-today-view";

const PHASE_CHECKPOINT = {
  kind: "boss",
  mock: false,
  passMark: 0,
  phase: 1,
  rematch: false,
  timeLimitMinutes: null,
} as const;

async function readNextCall(goalId: string) {
  const result = await getTodayView({ goalId });

  if (result.status !== "ready") {
    throw new Error(`Expected Today to be ready, received ${result.status}`);
  }

  const { goal, session } = result.today;
  return findNextCall({ goalKind: goal.kind, session });
}

async function languageDayFixture({
  checkpoint = PHASE_CHECKPOINT,
  lessonFirst = false,
  saved = true,
}: { checkpoint?: Record<string, unknown>; lessonFirst?: boolean; saved?: boolean } = {}) {
  const { goal, lessons, plan, user } = await languageGoalFixture();

  const [boss] = await Promise.all([
    planItemFixture({ kind: "boss", phase: 1, planId: plan.id, position: 10 }),
    prisma.goal.update({ data: { timezone: "UTC" }, where: { id: goal.id } }),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  mockSession(user.id);

  if (!saved) {
    return { goal, user };
  }

  const session = await studySessionFixture({ goalId: goal.id, userId: user.id });
  const lesson = lessons.at(-1);

  const [lessonBlock, call] = await Promise.all([
    lessonFirst && lesson
      ? studySessionBlockFixture({
          kind: "learn",
          lessonId: lesson.id,
          payload: { title: lesson.title },
          position: 0,
          sessionId: session.id,
        })
      : null,
    studySessionBlockFixture({
      kind: "checkpoint",
      payload: { checkpoint, planItemId: boss.id },
      position: lessonFirst ? 1 : 0,
      sessionId: session.id,
    }),
  ]);

  return { call, goal, lessonBlock, session, user };
}

describe(findNextCall, () => {
  it("names a language goal's unit call that's next on a saved day", async () => {
    const { call, goal, session } = await languageDayFixture();

    await expect(readNextCall(goal.id)).resolves.toStrictEqual({
      blockId: call?.id,
      sessionId: session?.id,
    });
  });

  it("names nothing once the call is under way: Continue resumes it with a request", async () => {
    const { call, goal } = await languageDayFixture();
    await prisma.studySessionBlock.update({ data: { status: "active" }, where: { id: call?.id } });
    await expect(readNextCall(goal.id)).resolves.toBeNull();
  });

  it("names nothing while a lesson comes before the call", async () => {
    const { goal } = await languageDayFixture({ lessonFirst: true });
    await expect(readNextCall(goal.id)).resolves.toBeNull();
  });

  it("names nothing for the week's challenge, which isn't a call", async () => {
    const { goal } = await languageDayFixture({
      checkpoint: { ...PHASE_CHECKPOINT, kind: "weekly", phase: null },
    });

    await expect(readNextCall(goal.id)).resolves.toBeNull();
  });

  it("names nothing before the day is opened: its steps have no ids yet", async () => {
    const { goal } = await languageDayFixture({ saved: false });
    await expect(readNextCall(goal.id)).resolves.toBeNull();
  });

  it("names nothing for another goal's phase challenge, a duel of questions", async () => {
    const { goal, user } = await languageDayFixture({ saved: false });

    const course = await goalFixture({
      timezone: "UTC",
      title: "Learn chemistry",
      userId: user.id,
    });

    const plan = await planFixture({
      goalId: course.id,
      phases: [{ name: "Basics" }, { name: "Practice" }],
    });

    const [boss, session] = await Promise.all([
      planItemFixture({ kind: "boss", phase: 1, planId: plan.id, position: 0 }),
      studySessionFixture({ goalId: course.id, userId: user.id }),
    ]);

    await studySessionBlockFixture({
      kind: "checkpoint",
      payload: { checkpoint: PHASE_CHECKPOINT, planItemId: boss.id },
      position: 0,
      sessionId: session.id,
    });

    await expect(readNextCall(course.id)).resolves.toBeNull();
    expect(goal.kind).toBe("language");
  });
});
