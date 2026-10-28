import { prisma } from "@zoonk/db";
import { layOutPlanFixture } from "@zoonk/testing/fixtures/goals";
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
import { getWeeklyChallenge } from "./get-weekly-challenge";
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
      studySessionFixture({
        goalId: goal.id,
        localDate: SESSION_TODAY,
        planVersion: plan.version,
        userId: user.id,
      }),
    ]);

    await layOutPlanFixture(plan.id);
    const saved = await readDay(day.id);
    expect(saved.blocks).toHaveLength(0);

    await expect(
      getChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id }),
    ).resolves.toMatchObject({
      challenge: { blockId: null, minutes: null, questions: null, status: "waiting", topics: [] },
      status: "ready",
    });

    await expect(readDay(day.id)).resolves.toStrictEqual(saved);

    await expect(
      startChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id }),
    ).resolves.toStrictEqual({ status: "notToday" });

    await expect(readDay(day.id)).resolves.toStrictEqual(saved);
  });

  it("keeps the weekly offer unknown until Start persists its seven questions and topics", async () => {
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

    await prisma.planItem.update({ data: { titleSnapshot: "" }, where: { id: weekly.id } });

    await expect(getWeeklyChallenge({ goalId: goal.id, timeZone: "UTC" })).resolves.toMatchObject({
      challenge: { planItemId: weekly.id, questions: null, title: null },
      status: "ready",
    });

    const preview = await getChallenge({ input: { timeZone: "UTC" }, planItemId: weekly.id });

    expect(preview).toMatchObject({
      challenge: {
        blockId: null,
        estimatedMinutes: null,
        kind: "weekly",
        minutes: null,
        passMark: null,
        questions: null,
        status: "ready",
        topics: [],
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
