import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitForBlockedStatement } from "../_test-utils/learner-lock";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayStudySession } from "./_test-utils/open-today";
import { SESSION_NOW, sessionGoalFixture } from "./_test-utils/session-goal";
import { settleFinishedLesson } from "./settle-finished-lesson";
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
    const { user } = await today();
    const elsewhere = await sessionGoalFixture({ lessons: 1, userId: user.id });
    const lessonId = elsewhere.lessons[0]?.id ?? "";

    await expect(
      settleFinishedLesson({ lessonId, timeZone: "UTC", userId: user.id }),
    ).resolves.toBeNull();

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: elsewhere.planItems[0]?.id } }),
    ).resolves.toMatchObject({ status: "done" });

    await settleFinishedLesson({ lessonId, timeZone: "UTC", userId: user.id });
  });

  it("changes nothing when a test-out takes the lesson's last item while the check-off waits", async () => {
    const { user } = await today();
    const elsewhere = await sessionGoalFixture({ lessons: 1, userId: user.id });
    const lessonId = elsewhere.lessons[0]?.id ?? "";
    const itemId = elsewhere.planItems[0]?.id ?? "";

    const held = Promise.withResolvers<number>();
    const release = Promise.withResolvers<null>();

    const testOut = prisma.$transaction(async (tx) => {
      await tx.planItem.update({ data: { status: "testedOut" }, where: { id: itemId } });
      const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      held.resolve(backend?.pid ?? 0);
      await release.promise;
    });

    const pid = await held.promise;
    const settled = settleFinishedLesson({ lessonId, timeZone: "UTC", userId: user.id });

    try {
      await waitForBlockedStatement(pid, /plan_items/u);
    } finally {
      release.resolve(null);
      await testOut;
    }

    await expect(settled).resolves.toBeNull();

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: itemId } }),
    ).resolves.toMatchObject({ status: "testedOut" });
  });
});
