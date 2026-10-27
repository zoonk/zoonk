import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { calculateBeltLevel } from "@zoonk/utils/belt-level";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { SESSION_NOW } from "../../sessions/_test-utils/session-goal";
import { settleLearnerMissions } from "../../sessions/missions/settle-learner-missions";
import { answerRight, scheduledMockSetup } from "./_test-utils/scheduled-mock";
import { finishMock } from "./finish-mock";
import { getMock } from "./get-mock";
import { startMock } from "./start-mock";

const DAY_MS = 86_400_000;

/** Today's missions as the session stores them: the mock's, anchored to its plan item, and `others`. */
async function setDayMissions({
  others = [],
  planItemId,
  sessionId,
}: {
  others?: { anchor: Record<string, never>; kind: "call"; total: number }[];
  planItemId: string;
  sessionId: string;
}) {
  await prisma.studySession.update({
    data: {
      missions: {
        picks: [
          { anchor: { blockKind: "checkpoint", planItemId }, kind: "mock", total: 1 },
          ...others,
        ],
        version: 1,
      },
    },
    where: { id: sessionId },
  });
}

/** Starts today's mock, answers some of it and hands it in. */
async function sitMock(blockId: string) {
  await startMock({ blockId, input: {} });
  await answerRight({ blockId, count: 3 });
  await expect(finishMock({ blockId, input: {} })).resolves.toStrictEqual({ status: "finished" });
}

async function readMoment(blockId: string) {
  const result = await getMock(blockId);
  return result.status === "ready" ? result.mock.missionMoment : "notReady";
}

describe("a mock's mission moment", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says the mock completed the day's last mission, +50 once, on every read that day", async () => {
    const { blockId, mockItem, user } = await scheduledMockSetup();
    const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });
    await setDayMissions({ planItemId: mockItem.id, sessionId: block.sessionId });

    await sitMock(blockId);

    const mock = await prisma.mockExam.findUniqueOrThrow({ where: { blockId } });
    const source = { id: mock.id, kind: "mockExam" };
    const moment = await readMoment(blockId);

    expect(moment).toMatchObject({
      completed: ["mock"],
      fullMeal: { bonus: 50, paid: true },
      missions: [{ kind: "mock", status: "done" }],
    });

    // A reload reads the same moment from what settlement recorded.
    await expect(readMoment(blockId)).resolves.toStrictEqual(moment);

    const session = await prisma.studySession.findUniqueOrThrow({ where: { id: block.sessionId } });

    expect(session.startSnapshot).toMatchObject({ fullMealSource: source });
    expect(session.missions).toMatchObject({ picks: [{ completedBy: source, kind: "mock" }] });

    const progress = await prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } });

    // Handing it in again pays nothing more.
    await expect(finishMock({ blockId, input: {} })).resolves.toStrictEqual({ status: "finished" });

    await expect(
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ totalBrainPower: progress.totalBrainPower });

    // The next day it's no longer today's: the result stays, its moment doesn't.
    vi.setSystemTime(new Date(SESSION_NOW.getTime() + 2 * DAY_MS));
    await expect(readMoment(blockId)).resolves.toBeNull();
  });

  it("says the mission the mock completed without the bonus while another is left", async () => {
    const { blockId, mockItem } = await scheduledMockSetup();
    const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });

    await setDayMissions({
      others: [{ anchor: {}, kind: "call", total: 1 }],
      planItemId: mockItem.id,
      sessionId: block.sessionId,
    });

    await sitMock(blockId);

    await expect(readMoment(blockId)).resolves.toMatchObject({
      completed: ["mock"],
      fullMeal: { bonus: 50, paid: false },
      missions: [
        { kind: "mock", status: "done" },
        { kind: "call", status: "todo" },
      ],
    });
  });

  it.each([false, true])(
    "keeps a carried-over receipt only before today's session starts (started: %s)",
    async (todayStarted) => {
      const { blockId, goal, mockItem, user } = await scheduledMockSetup("raw", 240);
      const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });

      await setDayMissions({ planItemId: mockItem.id, sessionId: block.sessionId });

      const beforeMidnight = new Date("2026-09-30T22:50:00Z");
      const afterMidnight = new Date("2026-10-01T00:05:00Z");
      vi.setSystemTime(beforeMidnight);
      await startMock({ blockId, input: {} });
      await answerRight({ blockId, count: 3 });

      // After more than an hour away, Today can start a new session while the long mock's clock runs.
      vi.setSystemTime(afterMidnight);

      if (todayStarted) {
        await studySessionFixture({
          goalId: goal.id,
          localDate: new Date("2026-10-01T00:00:00Z"),
          startedAt: new Date("2026-10-01T00:01:00Z"),
          status: "active",
          userId: user.id,
        });
      }

      await expect(finishMock({ blockId, input: {} })).resolves.toStrictEqual({
        status: "finished",
      });

      const moment = await readMoment(blockId);

      if (moment === "notReady") {
        throw new Error("The finished mock wasn't ready to read");
      }

      expect(moment?.completed ?? null).toStrictEqual(todayStarted ? null : ["mock"]);

      expect(moment?.fullMeal ?? null).toStrictEqual(
        todayStarted ? null : { bonus: 50, paid: true },
      );
    },
  );

  it("keeps the level its Brain Power reached for every read of its result", async () => {
    const { blockId, user } = await scheduledMockSetup();

    // One point short of the white belt's level 2.
    await prisma.userProgress.upsert({
      create: { lastActiveAt: SESSION_NOW, totalBrainPower: 249n, userId: user.id },
      update: { totalBrainPower: 249n },
      where: { userId: user.id },
    });

    await sitMock(blockId);

    const read = async () => {
      const result = await getMock(blockId);
      return result.status === "ready" ? result.mock.reached : "notReady";
    };

    // The level its points (the challenge's bonus included) took the learner to.
    const progress = await prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } });
    const { color, level } = calculateBeltLevel(Number(progress.totalBrainPower));

    expect(level).toBeGreaterThan(1);
    await expect(read()).resolves.toMatchObject({ level: { color, level } });
    await expect(read()).resolves.toMatchObject({ level: { color, level } });
  });

  it("has no moment before it's over", async () => {
    const { blockId, mockItem } = await scheduledMockSetup();
    const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });
    await setDayMissions({ planItemId: mockItem.id, sessionId: block.sessionId });

    await startMock({ blockId, input: {} });

    await expect(readMoment(blockId)).resolves.toBeNull();
  });

  it("says what its speaking paper's calls did to the day's missions", async () => {
    const user = await userFixture();
    const sectionId = randomUUID();

    const goal = await goalFixture({
      kind: "exam",
      targetLanguage: "es",
      timezone: "UTC",
      userId: user.id,
    });

    const [call] = await Promise.all([
      prisma.languageConversation.create({
        data: {
          endedAt: SESSION_NOW,
          goalId: goal.id,
          kind: "examSpeaking",
          language: "pt",
          level: "B2",
          minutes: 6,
          scenario: {},
          sectionId,
          spokenSeconds: 300,
          startedAt: SESSION_NOW,
          status: "completed",
          targetLanguage: "es",
          titleSnapshot: "Tarea 1",
          userId: user.id,
        },
      }),
      studySessionFixture({
        goalId: goal.id,
        localDate: new Date("2026-09-30T00:00:00Z"),
        missions: { picks: [{ anchor: {}, kind: "call", total: 1 }], version: 1 },
        userId: user.id,
      }),
    ]);

    // The call's end settles the day's missions with its own source, as its completion does.
    await settleLearnerMissions({
      source: { id: call.id, kind: "conversation" },
      timeZone: "UTC",
      userId: user.id,
    });

    const mock = await prisma.mockExam.create({
      data: {
        conditions: {
          day: null,
          examQuestions: null,
          fullLength: true,
          partialCredit: "allOrNothing",
          purpose: "practice",
          reused: 0,
          scoring: "raw",
          sections: [
            {
              essays: [],
              itemIds: [],
              kind: "speaking",
              minutes: 40,
              name: "Expresión e interacción orales",
              questions: 0,
              routing: null,
              speakingSectionId: sectionId,
            },
          ],
          shape: { area: null, day: null, kind: "full" },
          startTime: null,
          timeZone: null,
          timedOutSections: [],
          wrongPenalty: 1,
        },
        finishedAt: SESSION_NOW,
        goalId: goal.id,
        sectionIndex: 1,
        sectionStartedAt: SESSION_NOW,
        startedAt: SESSION_NOW,
        status: "finished",
        userId: user.id,
      },
    });

    mockSession(user.id);

    await expect(readMoment(mock.id)).resolves.toMatchObject({
      completed: ["call"],
      fullMeal: { bonus: 50, paid: true },
      missions: [{ kind: "call", status: "done" }],
    });
  });
});
