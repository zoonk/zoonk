import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STUDY_SESSION_INCLUDE } from "../_utils/study-session-access";
import { toBlockPayload } from "../block-payload";
import { getDayFirstSteps } from "./get-day-first-steps";
import { getDayMissions } from "./get-day-missions";

const BOSS = {
  kind: "boss" as const,
  mock: false,
  passMark: 4,
  phase: 0,
  rematch: false,
  timeLimitMinutes: null,
};

describe(getDayFirstSteps, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the finished list on the calendar day its last step was done, in a session carried past midnight", async () => {
    const timeZone = "America/Sao_Paulo";
    const user = await userFixture();
    const goal = await goalFixture({ timezone: timeZone, userId: user.id });
    await planFixture({ goalId: goal.id });

    // The October 13 session is still running at 00:20 on October 14 in São Paulo.
    const session = await studySessionFixture({
      createdAt: new Date("2026-10-12T00:00:00Z"),
      goalId: goal.id,
      localDate: new Date("2026-10-13T00:00:00Z"),
      missions: { picks: [], version: 1 },
      startedAt: new Date("2026-10-14T02:50:00Z"),
      userId: user.id,
    });

    await studySessionBlockFixture({ kind: "review", sessionId: session.id });

    const thread = await prisma.lessonQuestionThread.create({
      data: { goalId: goal.id, kind: "plan", userId: user.id },
    });

    const earlier = new Date("2026-10-12T15:00:00Z");

    await Promise.all([
      learningEventFixture({ endedAt: earlier, kind: "lesson", userId: user.id }),
      learningEventFixture({ endedAt: earlier, kind: "review", userId: user.id }),
      mistakeFixture({ fixedAt: earlier, status: "fixed", userId: user.id }),
      // The last step at 00:10 on October 14 in São Paulo.
      prisma.lessonQuestion.create({
        data: {
          contextKind: "plan",
          contextSnapshot: {},
          createdAt: new Date("2026-10-14T03:10:00Z"),
          question: "What next?",
          requestFingerprint: "carried-first-steps",
          requestId: crypto.randomUUID(),
          threadId: thread.id,
        },
      }),
    ]);

    vi.useFakeTimers({ now: new Date("2026-10-14T03:20:00Z"), toFake: ["Date"] });

    const row = await prisma.studySession.findUniqueOrThrow({
      include: STUDY_SESSION_INCLUDE,
      where: { id: session.id },
    });

    const steps = await getDayFirstSteps({ missions: [], session: row, timeZone });
    expect(steps).toMatchObject({ completedOn: "2026-10-14", done: 4, total: 4 });
  });

  it("says a challenge step waits for the day's lessons when no mission covers it", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const plan = await planFixture({ goalId: goal.id });

    const [lessonItem, bossItem] = await Promise.all([
      planItemFixture({ kind: "lesson", planId: plan.id, position: 0 }),
      planItemFixture({ kind: "boss", planId: plan.id, position: 1 }),
    ]);

    // A short day: its two missions are the review and the new lesson, not the challenge.
    const session = await studySessionFixture({
      goalId: goal.id,
      missions: {
        picks: [
          { anchor: { blockKind: "review" }, kind: "review", total: 1 },
          {
            anchor: { blockKind: "learn", planItemIds: [lessonItem.id] },
            kind: "somethingNew",
            total: 1,
          },
        ],
        version: 1,
      },
      plannedMinutes: 14,
      userId: user.id,
    });

    await Promise.all([
      studySessionBlockFixture({
        estimatedMinutes: 2,
        kind: "review",
        position: 0,
        sessionId: session.id,
      }),
      studySessionBlockFixture({
        estimatedMinutes: 5,
        kind: "learn",
        payload: toBlockPayload({ planItemId: lessonItem.id }),
        position: 1,
        sessionId: session.id,
      }),
    ]);

    const challenge = await studySessionBlockFixture({
      estimatedMinutes: 7,
      kind: "checkpoint",
      payload: toBlockPayload({ checkpoint: BOSS, planItemId: bossItem.id }),
      position: 2,
      sessionId: session.id,
    });

    const row = await prisma.studySession.findUniqueOrThrow({
      include: STUDY_SESSION_INCLUDE,
      where: { id: session.id },
    });

    const missions = await getDayMissions({ session: row, timeZone: "UTC" });
    const steps = await getDayFirstSteps({ missions, session: row, timeZone: "UTC" });

    expect(missions.map((mission) => mission.kind)).toStrictEqual(["review", "somethingNew"]);

    expect(steps?.steps.find((step) => step.kind === "challenge")).toStrictEqual({
      kind: "challenge",
      opens: { blockId: challenge.id, kind: "block" },
      status: "available",
      waitReason: "lessons",
    });
  });
});
