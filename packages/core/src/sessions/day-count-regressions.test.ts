import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { loadActiveGoalDay } from "../learner/summary/_utils/summary-day";
import { settleSessionDay } from "./_utils/settle-session-day";
import { openStudyBlock } from "./open-block";
import { stopStudySession } from "./stop-study-session";

describe("day completion and playback", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-30T23:55:00Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("continues the second extra after the first crosses midnight", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const session = await studySessionFixture({
      endedAt: new Date(),
      startedAt: new Date(),
      status: "active",
      userId: user.id,
    });

    await studySessionBlockFixture({
      completedAt: new Date(),
      position: 0,
      sessionId: session.id,
      status: "completed",
    });

    const first = await studySessionBlockFixture({
      kind: "practice",
      payload: { extra: true },
      position: 1,
      sessionId: session.id,
    });

    const second = await studySessionBlockFixture({
      kind: "practice",
      payload: { extra: true },
      position: 2,
      sessionId: session.id,
    });

    vi.setSystemTime(new Date("2026-10-01T00:05:00Z"));

    await prisma.studySessionBlock.update({
      data: { completedAt: new Date(), status: "completed" },
      where: { id: first.id },
    });

    await settleSessionDay({ sessionId: session.id, timeZone: "UTC", userId: user.id });
    vi.setSystemTime(new Date("2026-10-01T00:06:00Z"));

    await expect(
      openStudyBlock({ target: { kind: "next", sessionId: session.id }, timeZone: "UTC" }),
    ).resolves.toMatchObject({ opening: { blockId: second.id, kind: "session" }, status: "ready" });

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
    ).resolves.toMatchObject({ endedAt: session.endedAt, status: "active" });

    vi.setSystemTime(new Date("2026-10-01T00:10:00Z"));

    await prisma.studySessionBlock.update({
      data: { completedAt: new Date(), status: "completed" },
      where: { id: second.id },
    });

    await settleSessionDay({ sessionId: session.id, timeZone: "UTC", userId: user.id });

    await expect(
      openStudyBlock({ target: { kind: "next", sessionId: session.id }, timeZone: "UTC" }),
    ).resolves.toMatchObject({ opening: { blockId: null, kind: "session" } });
  });

  it.each([0, 60])(
    "finishes an extras-only rest day after Stop only with study (%s seconds)",
    async (seconds) => {
      const user = await userFixture();
      mockSession(user.id);
      const session = await studySessionFixture({ plannedMinutes: 0, userId: user.id });

      const extra = await studySessionBlockFixture({
        kind: "practice",
        payload: { extra: true },
        sessionId: session.id,
      });

      if (seconds > 0) {
        await learningEventFixture({
          contentIds: { studySessionId: session.id },
          seconds,
          userId: user.id,
        });
      }

      await stopStudySession({ input: { timeZone: "UTC" }, sessionId: session.id });

      await expect(
        prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
      ).resolves.toMatchObject({ endedAt: seconds > 0 ? new Date() : null });

      await expect(
        openStudyBlock({ target: { kind: "next", sessionId: session.id }, timeZone: "UTC" }),
      ).resolves.toMatchObject({ opening: { blockId: extra.id, kind: "session" } });
    },
  );

  it("search selects the pending day block before an earlier extra", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const goal = await goalFixture({ timezone: "UTC", userId: user.id });
    const session = await studySessionFixture({ goalId: goal.id, userId: user.id });

    await studySessionBlockFixture({
      payload: { extra: true, title: "Extra" },
      position: 0,
      sessionId: session.id,
    });

    await studySessionBlockFixture({
      payload: { title: "Day lesson" },
      position: 1,
      sessionId: session.id,
    });

    const stored = await prisma.studySession.findUniqueOrThrow({
      include: { blocks: { orderBy: { position: "asc" } } },
      where: { id: session.id },
    });

    const result = await loadActiveGoalDay({
      goal,
      localDate: session.localDate,
      now: new Date(),
      phaseChallengesRequired: true,
      sessions: [stored],
      timeZone: "UTC",
    });

    expect(result.today?.next?.title).toBe("Day lesson");
  });
});
