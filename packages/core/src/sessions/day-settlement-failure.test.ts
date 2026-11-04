import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { listFollowUps } from "../follow-ups/follow-up-rows";
import { settleConversation } from "../language/conversations/_utils/settle-conversation";
import { setupPlayableLesson } from "../lesson-player/_test-utils/playable-lesson-setup";
import { completeLibraryLesson } from "../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { answerBlockInOrder } from "./_test-utils/answer-block";
import { DAY_MS, SESSION_NOW, SESSION_TODAY } from "./_test-utils/session-goal";
import { settleSessionDay } from "./_utils/settle-session-day";
import { toBlockPayload } from "./block-payload";
import { BRAIN_POWER_BONUS } from "./brain-power";
import { finishStudyBlock } from "./finish-study-block";
import { openStudyDay } from "./open-study-day";
import { settleOwedSessionDay } from "./settle-owed-session-day";
import { startStudyBlock } from "./start-study-block";

// A connection lost after the block's own write commits can't be produced on demand.
vi.mock("./_utils/settle-session-day", { spy: true });

const PRACTICE_MISSION = {
  picks: [{ anchor: { blockKind: "practice" }, kind: "practice", total: 1 }],
  version: 1,
};

/** What the API's follow-up run does with each day settlement a finished block owed. */
async function runOwedSettlements(userId: string) {
  const owed = await listFollowUps(userId);

  await Promise.all(
    owed.flatMap((row) =>
      row.kind === "settleSessionDay" ? [settleOwedSessionDay({ ...row.input, userId })] : [],
    ),
  );
}

function readSessionLedger({ sessionId, userId }: { sessionId: string; userId: string }) {
  return prisma.learningEvent.findFirstOrThrow({
    where: { contentIds: { equals: sessionId, path: ["studySessionId"] }, kind: "session", userId },
  });
}

async function practiceDay() {
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
  const goal = await goalFixture({ timezone: "UTC", userId: user.id });
  const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

  const session = await studySessionFixture({
    goalId: goal.id,
    localDate: SESSION_TODAY,
    missions: PRACTICE_MISSION,
    plannedMinutes: 3,
    userId: user.id,
  });

  const block = await studySessionBlockFixture({
    estimatedMinutes: 3,
    kind: "practice",
    payload: toBlockPayload({ itemIds: [item.id], skillIds: [skill.id] }),
    sessionId: session.id,
  });

  mockSession(user.id);
  const request = { blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id };

  await expect(startStudyBlock(request)).resolves.toMatchObject({ status: "ready" });
  await answerBlockInOrder({ blockId: block.id, sessionId: session.id });

  return { block, goal, request, session, user };
}

describe("a finished block's day settles even when its request fails after the block commits", () => {
  it("completes the day and pays its full meal for a learner who leaves without retrying", async () => {
    freezeClock();
    vi.setSystemTime(SESSION_NOW);
    const { block, goal, request, session, user } = await practiceDay();

    vi.mocked(settleSessionDay).mockRejectedValueOnce(new Error("Connection lost"));
    await expect(finishStudyBlock(request)).rejects.toThrow("Connection lost");
    await runOwedSettlements(user.id);

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + DAY_MS));
    await openStudyDay({ goalId: goal.id, shownDate: "2026-10-01", timeZone: "UTC" });

    const [saved, ledger, progress, finished] = await Promise.all([
      prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
      readSessionLedger({ sessionId: session.id, userId: user.id }),
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ]);

    expect(saved).toMatchObject({
      endedAt: SESSION_NOW,
      fullMealAt: SESSION_NOW,
      missions: { picks: [{ done: 1, kind: "practice" }] },
      status: "completed",
    });

    expect(ledger).toMatchObject({ brainPower: BRAIN_POWER_BONUS.fullMeal, endedAt: SESSION_NOW });

    expect(progress.totalBrainPower).toBe(BigInt(finished.brainPower + BRAIN_POWER_BONUS.fullMeal));

    await expect(
      prisma.followUp.findMany({ select: { key: true, kind: true }, where: { userId: user.id } }),
    ).resolves.toContainEqual({ key: session.id, kind: "rememberSession" });
  });

  it("leaves nothing for the owed settlement when the finish settled its own day", async () => {
    freezeClock();
    vi.setSystemTime(SESSION_NOW);
    const { request, user } = await practiceDay();

    await expect(finishStudyBlock(request)).resolves.toMatchObject({
      completion: { fullMeal: { paid: true }, sessionCompleted: true },
      status: "ready",
    });

    const owed = await countDatabaseStatements(() => runOwedSettlements(user.id));
    expect(owed.writes).toBe(0);
  });

  it("settles a planned day whose lesson finished from the plan page", async () => {
    freezeClock();
    vi.setSystemTime(new Date("2026-09-30T15:00:00Z"));

    const { lesson, skill, user } = await setupPlayableLesson({
      steps: ["explanation", "summary"],
    });

    const goal = await goalFixture({ timezone: "UTC", userId: user.id });
    await planFixture({ goalId: goal.id, items: [{ lessonId: lesson.id, skillId: skill.id }] });

    const started = await startLibraryLesson({ input: { timeZone: "UTC" }, lessonId: lesson.id });

    if (started.status !== "started") {
      throw new Error(`Expected the lesson to start, got ${started.status}`);
    }

    const day = await prisma.studySession.findFirstOrThrow({ where: { goalId: goal.id } });
    expect(day.status).toBe("planned");

    vi.mocked(settleSessionDay).mockRejectedValueOnce(new Error("Connection lost"));

    await expect(
      completeLibraryLesson({
        input: { runId: started.run.runId, timeZone: "UTC" },
        lessonId: lesson.id,
      }),
    ).rejects.toThrow("Connection lost");

    await runOwedSettlements(user.id);

    vi.setSystemTime(new Date("2026-10-01T09:00:00Z"));
    await openStudyDay({ goalId: goal.id, shownDate: "2026-10-01", timeZone: "UTC" });

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: day.id } }),
    ).resolves.toMatchObject({ fullMealAt: new Date("2026-09-30T15:00:00Z"), status: "completed" });
  });

  it("settles a call's day when nobody waits for the call's review", async () => {
    freezeClock();
    vi.setSystemTime(SESSION_NOW);
    const user = await userFixture();
    const goal = await goalFixture({ timezone: "UTC", userId: user.id });

    const [session] = await Promise.all([
      studySessionFixture({
        goalId: goal.id,
        localDate: SESSION_TODAY,
        startedAt: SESSION_NOW,
        status: "active",
        userId: user.id,
      }),
      prisma.userProgress.create({ data: { userId: user.id } }),
    ]);

    const block = await studySessionBlockFixture({
      kind: "practice",
      sessionId: session.id,
      status: "active",
    });

    const row = await prisma.languageConversation.create({
      data: {
        goalId: goal.id,
        kind: "practice",
        language: "en",
        level: "A2",
        minutes: 1,
        reviewRunId: "wrun_unwatched_review",
        scenario: {},
        studyBlockId: block.id,
        targetLanguage: "es",
        titleSnapshot: "A practice call",
        userId: user.id,
      },
      include: { chapter: { select: { id: true, title: true } } },
    });

    await settleConversation({
      bossKind: "boss",
      feedback: null,
      objectives: 1,
      objectivesMet: ["Ordered a coffee"],
      reviewRunId: "wrun_unwatched_review",
      row,
      speakingEvidence: null,
      spokenSeconds: 60,
      timeZone: "UTC",
      usedHelp: false,
      userId: user.id,
    });

    await runOwedSettlements(user.id);

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
    ).resolves.toMatchObject({ endedAt: SESSION_NOW, status: "completed" });
  });
});
