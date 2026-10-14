import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import {
  SESSION_NOW,
  checkpointItemFixture,
  sessionGoalFixture,
} from "../sessions/_test-utils/session-goal";
import { getChallenge } from "./get-challenge";
import { startChallenge } from "./start-challenge";

describe("a challenge intro is a read", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("offers a due checkpoint without writing, then creates its queue only on Start", async () => {
    const user = await userFixture();

    const { goal, plan, planItems } = await sessionGoalFixture({
      itemsPerSkill: 10,
      userId: user.id,
    });

    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });

    await prisma.planItem.updateMany({
      data: { completedAt: SESSION_NOW, status: "done" },
      where: { id: { in: planItems.map((item) => item.id) } },
    });

    const boss = await checkpointItemFixture({ kind: "boss", planId: plan.id, position: 3 });
    mockSession(user.id);

    const before = await prisma.plan.findUniqueOrThrow({
      include: { changes: true, items: { orderBy: { position: "asc" } } },
      where: { id: plan.id },
    });

    const read = await getChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id });

    if (read.status !== "ready") {
      throw new Error("Expected the actual owned challenge intro");
    }

    expect(read.challenge.status).toBe("ready");
    expect(read.challenge.blockId).toBeNull();
    expect(read.challenge.estimatedMinutes).toBe(15);
    expect(read.challenge.questions).toBe(10);

    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);
    await expect(prisma.learningEvent.count({ where: { userId: user.id } })).resolves.toBe(0);

    await expect(
      prisma.plan.findUniqueOrThrow({
        include: { changes: true, items: { orderBy: { position: "asc" } } },
        where: { id: plan.id },
      }),
    ).resolves.toStrictEqual(before);

    const started = await startChallenge({ input: { timeZone: "UTC" }, planItemId: boss.id });

    if (started.status !== "ready") {
      throw new Error(`Expected Start to open the real checkpoint, got ${started.status}`);
    }

    const block = await prisma.studySessionBlock.findUniqueOrThrow({
      where: { id: started.destination.blockId },
    });

    expect(block.sessionId).toBe(started.destination.sessionId);
    expect(block.status).toBe("active");
    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(1);
  });
});
