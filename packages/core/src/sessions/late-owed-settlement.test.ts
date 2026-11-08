import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO } from "@zoonk/testing/fixtures/language";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanupTestCalls,
  connectTestCall,
  testCallCompletionInput,
} from "../_test-utils/connect-test-call";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { reviewRunsInline } from "../_test-utils/review-runs";
import { completeLanguageConversation } from "../language/conversations/complete-language-conversation";
import { answerBlockInOrder } from "./_test-utils/answer-block";
import { SESSION_NOW, SESSION_TODAY } from "./_test-utils/session-goal";
import { settleSessionDay } from "./_utils/settle-session-day";
import { toBlockPayload } from "./block-payload";
import { BRAIN_POWER_BONUS } from "./brain-power";
import { finishStudyBlock } from "./finish-study-block";
import { type MissionCompletionSource } from "./missions/settle-missions";
import { settleOwedSessionDay } from "./settle-owed-session-day";
import { startStudyBlock } from "./start-study-block";

// The follow-up's timing can't be produced on demand, so it runs inside the request's settlement.
vi.mock("./_utils/settle-session-day", { spy: true });

async function learner() {
  freezeClock();
  vi.setSystemTime(SESSION_NOW);

  const user = await userFixture();
  const goal = await goalFixture({ timezone: "UTC", userId: user.id });

  mockSession(user.id);
  return { goal, user };
}

function today({ goalId, picks, userId }: { goalId: string; picks: object[]; userId: string }) {
  return studySessionFixture({
    goalId,
    localDate: SESSION_TODAY,
    missions: { picks, version: 1 },
    startedAt: SESSION_NOW,
    status: "active",
    userId,
  });
}

async function practiceBlock(sessionId: string) {
  const skill = await skillFixture();
  const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

  return studySessionBlockFixture({
    estimatedMinutes: 3,
    kind: "practice",
    payload: toBlockPayload({ itemIds: [item.id], skillIds: [skill.id] }),
    sessionId,
  });
}

async function play({ blockId, sessionId }: { blockId: string; sessionId: string }) {
  const request = { blockId, input: { timeZone: "UTC" }, sessionId };
  await expect(startStudyBlock(request)).resolves.toMatchObject({ status: "ready" });
  await answerBlockInOrder({ blockId, sessionId });
  return request;
}

/** The next request's day settlement waits behind an earlier block's late follow-up. */
async function runOwedFirst({
  blockId,
  sessionId,
  source,
  userId,
}: {
  blockId: string;
  sessionId: string;
  source?: MissionCompletionSource;
  userId: string;
}) {
  const { settleSessionDay: settle } = await vi.importActual<{
    settleSessionDay: typeof settleSessionDay;
  }>("./_utils/settle-session-day");

  vi.mocked(settleSessionDay).mockImplementationOnce(async (input) => {
    await settleOwedSessionDay({ blockId, sessionId, source, timeZone: "UTC", userId });
    return settle(input);
  });
}

const FULL_MEAL = { bonus: BRAIN_POWER_BONUS.fullMeal, paid: true };

describe("an earlier block's owed settlement that runs late", () => {
  afterEach(async () => {
    await cleanupTestCalls();
  });

  it("leaves the full meal to the practice block that finished the day", async () => {
    const { goal, user } = await learner();

    const session = await today({
      goalId: goal.id,
      picks: [{ anchor: { blockKind: "practice" }, kind: "practice", total: 2 }],
      userId: user.id,
    });

    const [first, last] = await Promise.all([practiceBlock(session.id), practiceBlock(session.id)]);

    await finishStudyBlock(await play({ blockId: first.id, sessionId: session.id }));
    const finishLast = await play({ blockId: last.id, sessionId: session.id });
    await runOwedFirst({ blockId: first.id, sessionId: session.id, userId: user.id });

    await expect(finishStudyBlock(finishLast)).resolves.toMatchObject({
      completion: { completedMissions: ["practice"], fullMeal: FULL_MEAL, sessionCompleted: true },
      status: "ready",
    });
  });

  it("leaves the full meal to the block after a call, and the call's retry doesn't claim it", async () => {
    const { goal, user } = await learner();

    const [chapter, plan] = await Promise.all([
      libraryChapterFixture(),
      planFixture({ goalId: goal.id }),
    ]);

    const item = await planItemFixture({ kind: "boss", planId: plan.id });

    const session = await today({
      goalId: goal.id,
      picks: [
        { anchor: { planItemId: item.id }, kind: "challenge", total: 1 },
        { anchor: { blockKind: "practice" }, kind: "practice", total: 1 },
      ],
      userId: user.id,
    });

    const practice = await practiceBlock(session.id);

    const callBlock = await studySessionBlockFixture({
      kind: "checkpoint",
      payload: {
        checkpoint: { kind: "boss", mock: false, passMark: 75, phase: 0, timeLimitMinutes: 6 },
        planItemId: item.id,
      },
      sessionId: session.id,
      status: "active",
    });

    const call = await prisma.languageConversation.create({
      data: {
        chapterId: chapter.id,
        goalId: goal.id,
        kind: "checkpoint",
        language: "en",
        level: "A2",
        minutes: 6,
        objectivesMet: RENTING_SCENARIO.objectives.map((objective) => objective.label),
        scenario: RENTING_SCENARIO,
        startedAt: SESSION_NOW,
        studyBlockId: callBlock.id,
        targetLanguage: "es",
        titleSnapshot: "A challenge call",
        userId: user.id,
      },
    });

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    await connectTestCall(call.id);

    const finishCall = () =>
      completeLanguageConversation({
        conversationId: call.id,
        input: testCallCompletionInput(call.id, {
          spokenSeconds: 45,
          timeZone: "UTC",
          turns: [],
          usedHelp: false,
        }),
        runs: reviewRunsInline,
      });

    await expect(finishCall()).resolves.toMatchObject({
      missionMoment: { completed: ["challenge"], fullMeal: { paid: false } },
    });

    const finishPractice = await play({ blockId: practice.id, sessionId: session.id });

    await runOwedFirst({
      blockId: callBlock.id,
      sessionId: session.id,
      source: { id: call.id, kind: "conversation" },
      userId: user.id,
    });

    await expect(finishStudyBlock(finishPractice)).resolves.toMatchObject({
      completion: { completedMissions: ["practice"], fullMeal: FULL_MEAL },
    });

    await expect(finishCall()).resolves.toMatchObject({
      missionMoment: { completed: ["challenge"], fullMeal: { paid: false } },
    });
  });
});
