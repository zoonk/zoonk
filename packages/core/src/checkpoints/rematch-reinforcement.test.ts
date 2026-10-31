import { prisma } from "@zoonk/db";
import { layOutPlanFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { getTodayStudySession } from "../sessions/_test-utils/open-today";
import {
  DAY_MS,
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  sessionGoalFixture,
} from "../sessions/_test-utils/session-goal";
import { answerStudyQuestion } from "../sessions/answer-study-question";
import { finishStudyBlock } from "../sessions/finish-study-block";
import { startStudyBlock } from "../sessions/start-study-block";
import { getChallenge } from "./get-challenge";
import { getCheckpoint } from "./get-checkpoint";

describe("a lost duel's actual reinforcement lessons", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { count: 1, final: false },
    { count: 2, final: false },
    { count: 0, final: false },
    { count: 1, final: true },
  ])("reports $count lessons for a loss (final boss: $final)", async ({ count, final }) => {
    const user = await userFixture();

    const fixture = await sessionGoalFixture({
      itemsPerSkill: final ? 6 : 3,
      lessons: final ? 1 : 3,
      userId: user.id,
    });

    await prisma.planItem.updateMany({
      data: { status: "done" },
      where: { id: { in: fixture.planItems.slice(0, final ? 1 : 2).map((item) => item.id) } },
    });

    if (!final) {
      await prisma.planItem.update({
        data: { phase: 1, position: 5 },
        where: { id: fixture.planItems[2]?.id },
      });
    }

    const boss = await checkpointItemFixture({
      kind: "boss",
      planId: fixture.plan.id,
      position: 2,
    });

    await layOutPlanFixture(fixture.plan.id);
    mockSession(user.id);
    const today = await getTodayStudySession({ goalId: fixture.goal.id });
    const block = today.status === "ready" ? today.session.blocks[0] : null;

    if (today.status !== "ready" || !block || block.kind !== "checkpoint") {
      throw new Error("Expected today's boss");
    }

    await startStudyBlock({ blockId: block.id, input: {}, sessionId: today.session.id });

    if (count === 0) {
      await prisma.lesson.update({
        data: { setAsideAt: SESSION_NOW },
        where: { id: fixture.lessons[0]?.id },
      });
    }

    const firstSkill = fixture.items.filter((item) => item.skillId === fixture.skills[0]?.id);
    const missed = count === 2 ? [firstSkill[0], fixture.items[3]] : firstSkill.slice(0, 2);

    const feedback = await missed.reduce<Promise<unknown>>(async (previous, item) => {
      await previous;

      return answerStudyQuestion({
        blockId: block.id,
        input: { answer: { selectedIndex: 1 }, durationMs: 4000, itemId: item?.id ?? "" },
        sessionId: today.session.id,
      });
    }, Promise.resolve(null));

    await expect(getCheckpoint(block.id)).resolves.toMatchObject({
      checkpoint: { reinforcementLessons: count },
      status: "ready",
    });

    expect(feedback).toMatchObject({ feedback: { reinforcementLessons: count }, status: "ready" });

    await expect(
      finishStudyBlock({ blockId: block.id, input: {}, sessionId: today.session.id }),
    ).resolves.toMatchObject({ completion: { checkpoint: { passed: false } }, status: "ready" });

    await expect(getCheckpoint(block.id)).resolves.toMatchObject({
      checkpoint: { reinforcementLessons: count, result: { passed: false } },
    });

    await expect(getChallenge({ input: {}, planItemId: boss.id })).resolves.toMatchObject({
      challenge: { reinforcementLessons: count, status: "tried" },
      status: "ready",
    });

    await expect(
      prisma.planItem.findUniqueOrThrow({ select: { scheduledFor: true }, where: { id: boss.id } }),
    ).resolves.toStrictEqual({ scheduledFor: new Date(SESSION_TODAY.getTime() + DAY_MS) });

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + DAY_MS));
    const tomorrow = await getTodayStudySession({ goalId: fixture.goal.id });

    if (tomorrow.status !== "ready") {
      throw new Error("Expected tomorrow's session");
    }

    expect(tomorrow.session.blocks.filter((entry) => entry.reinforcement)).toHaveLength(count);

    expect(tomorrow.session.blocks.at(-1)?.checkpoint).toMatchObject({
      kind: final ? "finalBoss" : "boss",
      rematch: true,
    });
  });
});
