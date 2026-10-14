import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import {
  DAY_MS,
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  sessionGoalFixture,
} from "../sessions/_test-utils/session-goal";
import { readBlockPayload } from "../sessions/block-payload";
import { getChallenge } from "./get-challenge";
import { startChallenge } from "./start-challenge";

async function completedTeaching({ itemsPerSkill = 10, lessons = 3 } = {}) {
  const user = await userFixture();
  const fixture = await sessionGoalFixture({ itemsPerSkill, lessons, userId: user.id });

  await prisma.planItem.updateMany({
    data: { completedAt: SESSION_NOW, status: "done" },
    where: { planId: fixture.plan.id },
  });

  mockSession(user.id);
  return { ...fixture, user };
}

function readDay(sessionId: string) {
  return prisma.studySession.findUniqueOrThrow({
    include: { blocks: { orderBy: { position: "asc" } } },
    where: { id: sessionId },
  });
}

describe("checkpoint previews follow the day Start actually opens", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("waits when the saved day has no block for an otherwise due checkpoint", async () => {
    const { goal, plan, user } = await completedTeaching();

    const [boss, day] = await Promise.all([
      checkpointItemFixture({ kind: "boss", planId: plan.id, position: 3 }),
      studySessionFixture({ goalId: goal.id, localDate: SESSION_TODAY, userId: user.id }),
    ]);

    const saved = await readDay(day.id);
    expect(saved.blocks).toHaveLength(0);

    await expect(
      getChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id }),
    ).resolves.toMatchObject({
      challenge: { blockId: null, questions: 10, status: "waiting" },
      status: "ready",
    });

    await expect(readDay(day.id)).resolves.toStrictEqual(saved);

    await expect(
      startChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id }),
    ).resolves.toStrictEqual({ status: "notToday" });

    await expect(readDay(day.id)).resolves.toStrictEqual(saved);
  });

  it("reads the weekly preview's seven real questions and topics before Start persists them", async () => {
    const { goal, items, plan, skills, user } = await completedTeaching({
      itemsPerSkill: 7,
      lessons: 1,
    });

    const skill = skills[0]!;

    await attemptFixture({
      answeredAt: new Date(SESSION_NOW.getTime() - 2 * DAY_MS),
      itemId: items[0]!.id,
      skillId: skill.id,
      userId: user.id,
    });

    const weekly = await checkpointItemFixture({
      kind: "checkpoint",
      planId: plan.id,
      position: 1,
    });

    const preview = await getChallenge({ input: { timeZone: "UTC" }, planItemId: weekly.id });

    expect(preview).toMatchObject({
      challenge: {
        blockId: null,
        estimatedMinutes: 11,
        kind: "weekly",
        minutes: 11,
        passMark: null,
        questions: 7,
        status: "ready",
        topics: [{ name: skill.name, subject: null }],
      },
      status: "ready",
    });

    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);
    const started = await startChallenge({ input: { timeZone: "UTC" }, planItemId: weekly.id });

    if (started.status !== "ready") {
      throw new Error(`Expected the actual weekly checkpoint Start, got ${started.status}`);
    }

    const block = await prisma.studySessionBlock.findUniqueOrThrow({
      where: { id: started.destination.blockId },
    });

    const payload = readBlockPayload(block);
    expect(payload.itemIds).toHaveLength(7);
    expect(payload.checkpoint?.passMark).toBe(5);
    expect(block.estimatedMinutes).toBe(11);

    await expect(
      getChallenge({ input: { timeZone: "UTC" }, planItemId: weekly.id }),
    ).resolves.toMatchObject({
      challenge: {
        blockId: block.id,
        estimatedMinutes: 11,
        passMark: null,
        questions: 7,
        status: "started",
        topics: [{ name: skill.name, subject: null }],
      },
      status: "ready",
    });
  });
});
