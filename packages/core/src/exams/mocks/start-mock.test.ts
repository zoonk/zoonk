import { prisma } from "@zoonk/db";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { studySessionBlockFixture } from "@zoonk/testing/fixtures/study-sessions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_NOW } from "../../sessions/_test-utils/session-goal";
import { readBlockPayload } from "../../sessions/block-payload";
import { startStudyBlock } from "../../sessions/start-study-block";
import { MINUTE_MS, scheduledMockSetup } from "./_test-utils/scheduled-mock";
import { completeMock } from "./_utils/complete-mock";
import { getAskedItemIds } from "./_utils/mock-sections";
import { findOwnedMock } from "./_utils/owned-mock";
import { startMock } from "./start-mock";

async function openOtherBlock(blockId: string) {
  const block = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });
  const other = await studySessionBlockFixture({ kind: "practice", sessionId: block.sessionId });

  await expect(
    startStudyBlock({ blockId: other.id, input: {}, sessionId: block.sessionId }),
  ).resolves.toMatchObject({ status: "ready" });

  return other;
}

describe("scheduled mock focus", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resumes an active sitting's block clock without restarting the sitting", async () => {
    const { blockId } = await scheduledMockSetup();
    await expect(startMock({ blockId, input: {} })).resolves.toStrictEqual({ status: "ready" });

    const sitting = await prisma.mockExam.findUniqueOrThrow({ where: { blockId } });

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + 2 * MINUTE_MS));
    const other = await openOtherBlock(blockId);
    const paused = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });

    expect(readBlockPayload(paused).timing).toStrictEqual({
      activeAt: null,
      elapsedMs: 2 * MINUTE_MS,
    });

    const resumedAt = new Date(SESSION_NOW.getTime() + 6 * MINUTE_MS);
    vi.setSystemTime(resumedAt);

    await expect(startMock({ blockId, input: {} })).resolves.toStrictEqual({ status: "ready" });

    const [resumed, left] = await Promise.all([
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } }),
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: other.id } }),
    ]);

    expect(readBlockPayload(resumed).timing).toStrictEqual({
      activeAt: resumedAt.toISOString(),
      elapsedMs: 2 * MINUTE_MS,
    });

    expect(readBlockPayload(left).timing).toStrictEqual({
      activeAt: null,
      elapsedMs: 4 * MINUTE_MS,
    });

    await expect(prisma.mockExam.findUniqueOrThrow({ where: { blockId } })).resolves.toStrictEqual(
      sitting,
    );
  });

  it("keeps the latest paused clock when completion replaces reserved questions with those asked", async () => {
    const { blockId, skills } = await scheduledMockSetup();
    await startMock({ blockId, input: {} });

    const [block, reserved] = await Promise.all([
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } }),
      itemFixture({ content: choiceItemContent(), skillId: skills[0]?.id ?? "" }),
    ]);

    const payload = readBlockPayload(block);

    await prisma.studySessionBlock.update({
      data: { payload: { ...payload, itemIds: [...payload.itemIds, reserved.id] } },
      where: { id: blockId },
    });

    const found = await findOwnedMock(blockId);

    if (found.status !== "ready" || !found.owned.mock) {
      throw new Error("Expected the running scheduled mock");
    }

    vi.setSystemTime(new Date(SESSION_NOW.getTime() + 2 * MINUTE_MS));
    await openOtherBlock(blockId);
    vi.setSystemTime(new Date(SESSION_NOW.getTime() + 6 * MINUTE_MS));

    await completeMock({ mock: found.owned.mock, owned: found.owned, timeZone: "UTC" });

    const completed = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } });
    const kept = readBlockPayload(completed);

    expect(completed.status).toBe("completed");

    expect(kept.itemIds).toStrictEqual(
      getAskedItemIds(found.owned.mock.conditions).map((entry) => entry.itemId),
    );

    expect(kept.timing).toStrictEqual({ activeAt: null, elapsedMs: 2 * MINUTE_MS });
  });
});
