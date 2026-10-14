import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { toUTCMidnight } from "@zoonk/utils/date";
import { revalidateTag } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { readBlockPayload } from "./block-payload";
import { startStudyBlock } from "./start-study-block";

async function setup() {
  freezeClock();
  const user = await userFixture();
  const { goal, plan } = await unplannedGoalFixture({ timezone: "UTC", userId: user.id });
  const session = await studySessionFixture({ goalId: goal.id, userId: user.id });
  const block = await studySessionBlockFixture({ position: 0, sessionId: session.id });
  mockSession(user.id);
  return { block, plan, session, user };
}

async function versions({ plan, user }: Awaited<ReturnType<typeof setup>>) {
  const [saved, actor] = await Promise.all([
    prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
    prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
  ]);

  return { inputVersion: saved.inputVersion, learnerRevision: actor.learnerRevision };
}

function start(day: Awaited<ReturnType<typeof setup>>, blockId = day.block.id) {
  return startStudyBlock({ blockId, input: { timeZone: "UTC" }, sessionId: day.session.id });
}

describe("block start revisions", () => {
  it("commits one visible start for concurrent requests and keeps a running retry read-only", async () => {
    const day = await setup();
    const before = await versions(day);
    const results = await Promise.all([start(day), start(day)]);
    expect(results.map((result) => result.status)).toStrictEqual(["ready", "ready"]);
    expect(revalidateTag).not.toHaveBeenCalled();

    const active = await prisma.studySessionBlock.findUniqueOrThrow({
      where: { id: day.block.id },
    });

    expect(active.status).toBe("active");
    expect(readBlockPayload(active).timing?.activeAt).toBeTypeOf("string");

    const changed = { ...before, learnerRevision: before.learnerRevision + 1n };
    await expect(versions(day)).resolves.toStrictEqual(changed);
    vi.setSystemTime(new Date(Date.now() + 60_000));
    await expect(start(day)).resolves.toStrictEqual(results[0]);
    await expect(versions(day)).resolves.toStrictEqual(changed);

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: day.block.id } }),
    ).resolves.toStrictEqual(active);

    await expect(
      prisma.learningEvent.count({
        where: { goalId: day.session.goalId, kind: "session", userId: day.user.id },
      }),
    ).resolves.toBe(1);
  });

  it("publishes the switch and the paused block's resume without reopening the session ledger", async () => {
    const day = await setup();
    const other = await studySessionBlockFixture({ position: 1, sessionId: day.session.id });
    const before = await versions(day);
    await expect(start(day)).resolves.toMatchObject({ status: "ready" });
    vi.setSystemTime(new Date(Date.now() + 60_000));
    await expect(start(day, other.id)).resolves.toMatchObject({ status: "ready" });

    const paused = await prisma.studySessionBlock.findUniqueOrThrow({
      where: { id: day.block.id },
    });

    expect(readBlockPayload(paused).timing).toMatchObject({ activeAt: null, elapsedMs: 60_000 });
    await expect(start(day)).resolves.toMatchObject({ status: "ready" });

    await expect(versions(day)).resolves.toStrictEqual({
      ...before,
      learnerRevision: before.learnerRevision + 3n,
    });

    const resumed = await prisma.studySessionBlock.findUniqueOrThrow({
      where: { id: day.block.id },
    });

    expect(readBlockPayload(resumed).timing).toMatchObject({
      activeAt: new Date().toISOString(),
      elapsedMs: 60_000,
    });

    await expect(
      prisma.learningEvent.count({
        where: { goalId: day.session.goalId, kind: "session", userId: day.user.id },
      }),
    ).resolves.toBe(1);
  });

  it("rolls back the early mark and progress insert when the daily limit refuses a start", async () => {
    const day = await setup();
    await learningProfileFixture({ dailyLimitMinutes: 15, userId: day.user.id });

    await prisma.dailyProgress.create({
      data: {
        date: toUTCMidnight(new Date()),
        dayOfWeek: 0,
        timeSpentSeconds: 900,
        userId: day.user.id,
      },
    });

    const before = await versions(day);
    await expect(start(day)).resolves.toStrictEqual({ status: "dailyLimitReached" });
    await expect(versions(day)).resolves.toStrictEqual(before);

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: day.block.id } }),
    ).resolves.toStrictEqual(day.block);

    await expect(prisma.userProgress.count({ where: { userId: day.user.id } })).resolves.toBe(0);
  });
});
