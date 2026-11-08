import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { answerBlockInOrder } from "./_test-utils/answer-block";
import { SESSION_NOW, SESSION_TODAY } from "./_test-utils/session-goal";
import { settleSessionDay } from "./_utils/settle-session-day";
import { toBlockPayload } from "./block-payload";
import { BRAIN_POWER_BONUS } from "./brain-power";
import { finishStudyBlock } from "./finish-study-block";
import { settleOwedSessionDay } from "./settle-owed-session-day";
import { startStudyBlock } from "./start-study-block";

// The follow-up's timing can't be produced on demand, so it runs inside the request's settlement.
vi.mock("./_utils/settle-session-day", { spy: true });

async function playPractice({ sessionId, skillId }: { sessionId: string; skillId: string }) {
  const item = await itemFixture({ content: choiceItemContent(), skillId });

  const block = await studySessionBlockFixture({
    estimatedMinutes: 3,
    kind: "practice",
    payload: toBlockPayload({ itemIds: [item.id], skillIds: [skillId] }),
    sessionId,
  });

  const request = { blockId: block.id, input: { timeZone: "UTC" }, sessionId };
  await expect(startStudyBlock(request)).resolves.toMatchObject({ status: "ready" });
  await answerBlockInOrder({ blockId: block.id, sessionId });

  return { block, request };
}

describe("an earlier block's owed settlement that runs late", () => {
  it("leaves the full meal to the block that finished the day", async () => {
    freezeClock();
    vi.setSystemTime(SESSION_NOW);

    const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
    const goal = await goalFixture({ timezone: "UTC", userId: user.id });

    const session = await studySessionFixture({
      goalId: goal.id,
      localDate: SESSION_TODAY,
      missions: {
        picks: [{ anchor: { blockKind: "practice" }, kind: "practice", total: 2 }],
        version: 1,
      },
      plannedMinutes: 6,
      userId: user.id,
    });

    mockSession(user.id);

    const first = await playPractice({ sessionId: session.id, skillId: skill.id });
    await finishStudyBlock(first.request);

    const lastFinish = new Date(SESSION_NOW.getTime() + 60_000);
    vi.setSystemTime(lastFinish);

    const last = await playPractice({ sessionId: session.id, skillId: skill.id });

    const { settleSessionDay: settle } = await vi.importActual<{
      settleSessionDay: typeof settleSessionDay;
    }>("./_utils/settle-session-day");

    vi.mocked(settleSessionDay).mockImplementationOnce(async (input) => {
      await settleOwedSessionDay({
        blockId: first.block.id,
        sessionId: session.id,
        timeZone: "UTC",
        userId: user.id,
      });

      return settle(input);
    });

    const finished = await finishStudyBlock(last.request);
    const saved = await prisma.studySession.findUniqueOrThrow({ where: { id: session.id } });

    expect(finished).toMatchObject({
      completion: {
        completedMissions: ["practice"],
        fullMeal: { bonus: BRAIN_POWER_BONUS.fullMeal, paid: true },
        sessionCompleted: true,
      },
      status: "ready",
    });

    expect(saved.fullMealAt).toStrictEqual(lastFinish);
  });
});
