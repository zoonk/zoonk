import { prisma } from "@zoonk/db";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAllowance } from "../entitlements/get-allowance";
import { getLearnerSummary } from "../learner/summary/get-learner-summary";
import { lapsedDayFixture, readLapsedDayState } from "./_test-utils/entitlement-lapse";
import { SESSION_NOW } from "./_test-utils/session-goal";
import { openStudySession } from "./open-study-day";
import { startStudyBlock } from "./start-study-block";

describe("the frame's explicit Continue after Plus lapses", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("opens the free step the summary previews and Open saves, then replays without a mark", async () => {
    const day = await lapsedDayFixture();
    const summary = await getLearnerSummary();

    expect(summary?.today).toMatchObject({
      blocksLeft: 1,
      next: { sessionId: day.sessionId, title: day.planItems.at(-1)?.titleSnapshot },
    });

    const before = await readLapsedDayState(day.user.id);

    const continued = await openStudySession({
      input: { timeZone: "UTC" },
      sessionId: day.sessionId,
    });

    expect(continued.status).toBe("ready");

    if (continued.status !== "ready") {
      throw new Error("Expected the actual continued day");
    }

    const target = continued.session.blocks.find(
      (block) => block.id === continued.session.nextBlockId,
    );

    expect(target).toMatchObject({ kind: "learn", lessonId: day.planItems.at(-1)?.lessonId });

    expect(continued.session.blocks.some((block) => block.kind === "checkpoint")).toBe(false);
    const after = await readLapsedDayState(day.user.id);
    expect(after.plans[0]?.inputVersion).toBe(before.plans[0]!.inputVersion + 1);

    const replay = await countDatabaseStatements(() =>
      openStudySession({ input: { timeZone: "UTC" }, sessionId: day.sessionId }),
    );

    expect(replay.writes).toBe(0);
    await expect(readLapsedDayState(day.user.id)).resolves.toStrictEqual(after);

    await expect(
      startStudyBlock({ blockId: target!.id, input: {}, sessionId: day.sessionId }),
    ).resolves.toMatchObject({ block: { kind: "learn" }, status: "ready" });

    await expect(getAllowance()).resolves.toMatchObject({ callTime: { usedSeconds: 0 } });

    await expect(
      prisma.languageConversation.count({ where: { userId: day.user.id } }),
    ).resolves.toBe(0);
  });
});
