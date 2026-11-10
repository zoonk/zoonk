import { prisma } from "@zoonk/db";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_NOW,
  SESSION_TODAY,
  checkpointItemFixture,
  daysAgo,
  dueSkillFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { loadSessionBuildInput } from "./_utils/load-build-inputs";
import { getBlockItemIds } from "./block-payload";
import { buildSessionBlocks } from "./session-builder";

async function buildPhaseEndDay(lastLessonMinutes: number) {
  const user = await userFixture();

  const { goal, items, lessons, plan, planItems, skills } = await sessionGoalFixture({
    goal: { dailyMinutes: 30 },
    userId: user.id,
  });

  const mistakeItemId = items[0]?.id ?? "";

  await Promise.all([
    prisma.planItem.update({
      data: { completedAt: daysAgo(3), status: "done" },
      where: { id: planItems[0]?.id },
    }),
    prisma.lesson.update({
      data: { estimatedMinutes: lastLessonMinutes },
      where: { id: lessons[2]?.id },
    }),
    checkpointItemFixture({ kind: "boss", planId: plan.id, position: 3, scheduledFor: null }),
    dueSkillFixture({ skillId: skills[0]?.id ?? "", userId: user.id }),
    mistakeFixture({
      createdAt: daysAgo(1),
      itemId: mistakeItemId,
      skillId: skills[0]?.id,
      userId: user.id,
    }),
  ]);

  const input = await loadSessionBuildInput({
    goal,
    localDate: SESSION_TODAY,
    now: SESSION_NOW,
    timeZone: "UTC",
    userId: user.id,
  });

  return { blocks: buildSessionBlocks(input).blocks, mistakeItemId };
}

describe("a phase challenge's questions in the day", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("stay with the day's review, fixes and practice when the challenge doesn't fit", async () => {
    const { blocks, mistakeItemId } = await buildPhaseEndDay(60);

    expect(blocks.map((block) => block.kind)).toStrictEqual(["review", "learn", "practice"]);

    expect(
      blocks.flatMap((block) => block.payload.drills.flatMap((drill) => drill.itemIds)),
    ).toContain(mistakeItemId);
  });

  it("leave the day's other work when the challenge joins it after the phase's last lesson", async () => {
    const { blocks } = await buildPhaseEndDay(4);
    const challenge = blocks.find((block) => block.kind === "checkpoint");
    const others = blocks.filter((block) => block !== challenge);

    expect(blocks.map((block) => block.kind)).toStrictEqual(["learn", "learn", "checkpoint"]);

    expect(challenge?.payload.itemIds.length).toBeGreaterThan(0);

    expect(
      others
        .flatMap((block) => getBlockItemIds(block.payload))
        .filter((id) => challenge?.payload.itemIds.includes(id)),
    ).toStrictEqual([]);
  });
});
