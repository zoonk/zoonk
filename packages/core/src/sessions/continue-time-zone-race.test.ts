import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { revalidateTag } from "next/cache";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockAccountSession } from "../_test-utils/mock-session";
import { seedPersonaCopy } from "../seed/seed";
import { getTodayView } from "../view-models/today/get-today-view";
import { getStudySession } from "./get-study-session";
import { openStudyBlock } from "./open-block";
import { startStudyBlock } from "./start-study-block";

const NOW = new Date("2026-10-15T12:00:00Z");
const DEVICE_ZONE = "Pacific/Kiritimati";

describe("Continue on an already studied day while another device reads it", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps Ana's saved day and opens the same next free block beside a device read", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    const copyKey = randomUUID();

    const copy = await seedPersonaCopy({
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
        openStudyBlock({ target: { kind: "next", sessionId: saved.id }, timeZone: DEVICE_ZONE }),
      ),
    ]);

    expect(followed).toMatchObject({ status: "ready" });
    const target = before.session.blocks.find((block) => block.id === before.session.nextBlockId);
    expect(target).toMatchObject({ kind: "learn", lessonId: expect.any(String) });

    expect(opened.result).toMatchObject({
      opening: { lessonId: target?.lessonId, sessionId: saved.id },
      status: "ready",
    });

    expect(revalidateTag).toHaveBeenCalledTimes(expirations);

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
