import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitForBlockedStatement } from "../_test-utils/learner-lock";
import { mockSession } from "../_test-utils/mock-session";
import {
  setupPlayableLesson,
  stepOfKind,
} from "../lesson-player/_test-utils/playable-lesson-setup";
import { checkLessonStep } from "../lesson-player/check-lesson-step";
import { completeLibraryLesson } from "../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { getTodayStudySession } from "./_test-utils/open-today";
import { SESSION_NOW, sessionGoalFixture } from "./_test-utils/session-goal";
import { stopStudySession } from "./stop-study-session";

async function today() {
  const user = await userFixture();
  const fixture = await sessionGoalFixture({ lessons: 2, userId: user.id });
  mockSession(user.id);

  const result = await getTodayStudySession({ goalId: fixture.goal.id });

  if (result.status !== "ready") {
    throw new Error("Expected today's session");
  }

  return { ...fixture, session: result.session, user };
}

async function playLessonInPlan() {
  const { lesson, skill, steps, user } = await setupPlayableLesson({ steps: ["check"] });
  const goal = await goalFixture({ timezone: "UTC", userId: user.id });

  const {
    items: [planItem],
  } = await planFixture({ goalId: goal.id, items: [{ lessonId: lesson.id, skillId: skill.id }] });

  const started = await startLibraryLesson({ input: { timeZone: "UTC" }, lessonId: lesson.id });
  const runId = started.status === "started" ? started.run.runId : "";

  await checkLessonStep({
    input: {
      answer: { kind: "check", optionId: "likely" },
      durationMs: 4000,
      runId,
      timeZone: "UTC",
    },
    stepId: stepOfKind(steps, "check").id,
  });

  const complete = () =>
    completeLibraryLesson({ input: { runId, timeZone: "UTC" }, lessonId: lesson.id });

  return { complete, planItemId: planItem?.id ?? "" };
}

describe("stop and lesson writes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves the first stop, which Today shows, and not a second", async () => {
    const { session } = await today();

    await stopStudySession({ input: {}, sessionId: session.id });

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
    ).resolves.toMatchObject({ stoppedAt: expect.any(Date) });

    await stopStudySession({ input: {}, sessionId: session.id });
  });

  it("checks off a finished lesson's plan items once, and not again", async () => {
    const { complete, planItemId } = await playLessonInPlan();

    await expect(complete()).resolves.toMatchObject({ status: "completed" });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: planItemId } }),
    ).resolves.toMatchObject({ status: "done" });

    await expect(complete()).resolves.toMatchObject({ status: "completed" });
  });

  it("keeps a test-out that takes the lesson's last item while the check-off waits", async () => {
    const { complete, planItemId } = await playLessonInPlan();

    const held = Promise.withResolvers<number>();
    const release = Promise.withResolvers<null>();

    const testOut = prisma.$transaction(async (tx) => {
      await tx.planItem.update({ data: { status: "testedOut" }, where: { id: planItemId } });
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      held.resolve(backend?.pid ?? 0);
      await release.promise;
    });

    const pid = await held.promise;
    const completed = complete();

    try {
      await waitForBlockedStatement(pid, /plan_items/u);
    } finally {
      release.resolve(null);
      await testOut;
    }

    await expect(completed).resolves.toMatchObject({ status: "completed" });

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: planItemId } }),
    ).resolves.toMatchObject({ status: "testedOut" });
  });
});
