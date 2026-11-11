import { prisma } from "@zoonk/db";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DAY_MS,
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { loadSessionBuildInput } from "./_utils/load-build-inputs";
import { type PlannedBlock, buildSessionBlocks } from "./session-builder";

async function buildAndSaveDay({
  goal,
  index,
  userId,
}: {
  goal: Parameters<typeof loadSessionBuildInput>[0]["goal"];
  index: number;
  userId: string;
}): Promise<PlannedBlock[]> {
  const now = new Date(SESSION_NOW.getTime() + index * DAY_MS);
  const localDate = new Date(SESSION_TODAY.getTime() + index * DAY_MS);
  vi.setSystemTime(now);

  const built = buildSessionBlocks(
    await loadSessionBuildInput({ goal, localDate, now, timeZone: "UTC", userId }),
  );

  const session = await studySessionFixture({
    goalId: goal.id,
    localDate,
    plannedMinutes: built.plannedMinutes,
    userId,
  });

  await prisma.studySessionBlock.createMany({
    data: built.blocks.map((block, position) => ({ ...block, position, sessionId: session.id })),
  });

  return built.blocks;
}

describe("a challenge the learner didn't start", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it.each([15, 45])("goes after the lessons the next day (%i-minute days)", async (minutes) => {
    const user = await userFixture();

    const { goal, plan, planItems } = await sessionGoalFixture({
      goal: { dailyMinutes: minutes },
      itemsPerSkill: 10,
      userId: user.id,
    });

    await prisma.planItem.update({ data: { status: "done" }, where: { id: planItems[0]!.id } });

    await prisma.planItem.updateMany({
      data: { phase: 1, position: { increment: 2 } },
      where: { id: { in: planItems.slice(1).map((item) => item.id) } },
    });

    const boss = await checkpointItemFixture({ kind: "boss", planId: plan.id, position: 1 });

    const followsLessons = (day: PlannedBlock[]) =>
      day.findIndex((block) => block.payload.planItemId === boss.id) >
      day.findLastIndex((block) => block.kind === "learn");

    const first = await buildAndSaveDay({ goal, index: 0, userId: user.id });
    const second = await buildAndSaveDay({ goal, index: 1, userId: user.id });
    const third = await buildAndSaveDay({ goal, index: 2, userId: user.id });

    expect(first[0]?.payload.planItemId).toBe(boss.id);
    expect(second[0]?.kind).toBe("learn");
    expect(followsLessons(second)).toBe(minutes === 45);
    expect(third[0]?.kind).toBe(minutes === 15 ? "checkpoint" : "learn");
    expect(third.some((block) => block.payload.planItemId === boss.id)).toBe(true);
  });
});
