import { prisma } from "@zoonk/db";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_NOW } from "../../sessions/_test-utils/session-goal";
import { getBlockElapsedMs } from "../../sessions/_utils/block-timing";
import { readBlockPayload } from "../../sessions/block-payload";
import { startStudyBlock } from "../../sessions/start-study-block";
import { MINUTE_MS, answerRight, scheduledMockSetup } from "./_test-utils/scheduled-mock";
import { finishMock } from "./finish-mock";
import { mockConditionsSchema } from "./mock-contract";
import { startMock } from "./start-mock";

describe("starting a persisted scheduled mock", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("stops the expired block's focus clock while a replacement paper is preparing", async () => {
    const { blockId, goal } = await scheduledMockSetup();
    await expect(startMock({ blockId, input: {} })).resolves.toMatchObject({ status: "ready" });

    await prisma.item.updateMany({
      data: { retiredAt: SESSION_NOW },
      where: { examBlueprintId: goal.examBlueprintId, mockOnly: true },
    });

    vi.setSystemTime(SESSION_NOW.getTime() + 90 * MINUTE_MS);
    await expect(startMock({ blockId, input: {} })).resolves.toMatchObject({ status: "preparing" });

    const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });
    expect.soft(block).toMatchObject({ startedAt: null, status: "pending" });
    expect.soft(getBlockElapsedMs({ block, now: new Date(Date.now() + MINUTE_MS) })).toBe(0);

    await expect(
      startStudyBlock({ blockId, input: {}, sessionId: block.sessionId }),
    ).resolves.toStrictEqual({ status: "preparing" });
  });

  it("finishes a legacy block with an equally long list of different questions", async () => {
    const { blockId, skills } = await scheduledMockSetup();
    const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });

    const legacy = await Promise.all(
      Array.from({ length: 9 }, () =>
        itemFixture({ content: choiceItemContent(), skillId: skills[0]!.id }),
      ),
    );

    await prisma.studySessionBlock.update({
      data: { payload: { ...readBlockPayload(block), itemIds: legacy.map((item) => item.id) } },
      where: { id: blockId },
    });

    await expect(startMock({ blockId, input: {} })).resolves.toMatchObject({ status: "ready" });
    const sitting = await prisma.mockExam.findUniqueOrThrow({ where: { blockId } });

    const picked = mockConditionsSchema
      .parse(sitting.conditions)
      .sections.flatMap((part) => part.itemIds);

    expect(picked).toHaveLength(legacy.length);
    expect(picked).not.toStrictEqual(legacy.map((item) => item.id));

    await answerRight({ blockId, count: picked.length });
    await expect(finishMock({ blockId, input: {} })).resolves.toMatchObject({ status: "finished" });

    const finished = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });
    expect(finished.status).toBe("completed");
    expect(readBlockPayload(finished).itemIds).toStrictEqual(picked);
  });
});
