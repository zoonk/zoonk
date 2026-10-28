import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { revalidateTag } from "next/cache";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockAccountSession } from "../_test-utils/mock-session";
import { seedV2PersonaCopy } from "../seed/seed-v2";
import { getTodayView } from "../view-models/today/get-today-view";
import { getStudySession } from "./get-study-session";
import { openStudySession } from "./open-study-day";
import { startStudyBlock } from "./start-study-block";

const NOW = new Date("2026-10-15T12:00:00Z");
const DEVICE_ZONE = "Pacific/Kiritimati";

describe("Continue on an already studied day while another device reads it", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps Ana's saved day and opens the same next free block beside a device read", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const copyKey = randomUUID();

    const copy = await seedV2PersonaCopy({
      copyKey,
      email: `continue-zone-${copyKey}@zoonk.test`,
      persona: "exam",
    });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: copy.userId } });
    const goal = await prisma.goal.findUniqueOrThrow({ where: { id: copy.goalId } });

    const saved = await prisma.studySession.findFirstOrThrow({
      include: { blocks: { orderBy: { position: "asc" } } },
      orderBy: { localDate: "desc" },
      where: { goalId: goal.id, userId: user.id },
    });

    expect(saved.blocks.some((block) => block.startedAt !== null)).toBe(true);
    mockAccountSession({ user });
    const before = await getStudySession({ input: { timeZone: DEVICE_ZONE }, sessionId: saved.id });
    expect(before.status).toBe("ready");

    if (before.status !== "ready") {
      throw new Error("Expected the saved day");
    }

    const expirations = vi.mocked(revalidateTag).mock.calls.length;

    const [followed, opened] = await Promise.all([
      getTodayView({ goalId: goal.id, timeZone: DEVICE_ZONE }),
      countDatabaseStatements(() =>
        openStudySession({ input: { timeZone: DEVICE_ZONE }, sessionId: saved.id }),
      ),
    ]);

    expect(followed).toMatchObject({ status: "ready" });
    expect(opened.result.status).toBe("ready");

    if (opened.result.status !== "ready") {
      throw new Error("Expected Continue to resolve");
    }

    expect(opened.result.session).toMatchObject({
      current: true,
      id: saved.id,
      nextBlockId: before.session.nextBlockId,
    });

    expect(revalidateTag).toHaveBeenCalledTimes(expirations);
    const view = opened.result.session;
    const target = view.blocks.find((block) => block.id === view.nextBlockId);
    expect(target).toMatchObject({ kind: "learn", lessonId: expect.any(String) });

    await expect(
      startStudyBlock({
        blockId: target!.id,
        input: { timeZone: DEVICE_ZONE },
        sessionId: saved.id,
      }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      timezone: goal.timezone,
    });
  });
});
