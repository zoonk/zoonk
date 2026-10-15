import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readLearnerRevision } from "../_test-utils/learner-revision";
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

describe("stop and lesson revisions", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("raises the revision once for the first stop, which Today shows, and not for a second", async () => {
    const { session, user } = await today();
    const before = await readLearnerRevision(user.id);

    await stopStudySession({ input: {}, sessionId: session.id });

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
    ).resolves.toMatchObject({ stoppedAt: expect.any(Date) });

    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 1n);

    await stopStudySession({ input: {}, sessionId: session.id });
    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 1n);
  });

  it("raises it once when a finished lesson checks off its plan items, and not again", async () => {
    const { user } = await today();
    const elsewhere = await sessionGoalFixture({ lessons: 1, userId: user.id });
    const lessonId = elsewhere.lessons[0]?.id ?? "";
    const before = await readLearnerRevision(user.id);

    // Outside today's session: only the plan changes, and it changes once.
    await expect(
      settleFinishedLesson({ lessonId, timeZone: "UTC", userId: user.id }),
    ).resolves.toBeNull();

    await expect(
      prisma.planItem.findUniqueOrThrow({ where: { id: elsewhere.planItems[0]?.id } }),
    ).resolves.toMatchObject({ status: "done" });

    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 1n);

    await settleFinishedLesson({ lessonId, timeZone: "UTC", userId: user.id });
    await expect(readLearnerRevision(user.id)).resolves.toBe(before + 1n);
  });
});
