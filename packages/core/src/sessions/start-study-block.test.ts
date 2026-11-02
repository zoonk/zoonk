import { prisma } from "@zoonk/db";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { toUTCMidnight } from "@zoonk/utils/date";
import { describe, expect, it } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { startStudyBlock } from "./start-study-block";

async function setup() {
  freezeClock();
  const user = await userFixture();
  await learningProfileFixture({ dailyLimitMinutes: 15, userId: user.id });
  const session = await studySessionFixture({ userId: user.id });

  const blocks = await Promise.all([
    studySessionBlockFixture({ position: 0, sessionId: session.id }),
    studySessionBlockFixture({ position: 1, sessionId: session.id }),
  ]);

  mockSession(user.id);
  return { blocks, session, user };
}

async function reachLimit(userId: string) {
  await prisma.dailyProgress.create({
    data: { date: toUTCMidnight(new Date()), dayOfWeek: 0, timeSpentSeconds: 900, userId },
  });
}

function ledgerCount(sessionId: string) {
  return prisma.learningEvent.count({
    where: { contentIds: { equals: sessionId, path: ["studySessionId"] }, kind: "session" },
  });
}

describe(startStudyBlock, () => {
  it("leaves pending work and its session unopened when the daily time limit is reached", async () => {
    const { blocks, session, user } = await setup();
    await reachLimit(user.id);

    await expect(
      startStudyBlock({
        blockId: blocks[0]?.id ?? "",
        input: { timeZone: "UTC" },
        sessionId: session.id,
      }),
    ).resolves.toStrictEqual({ status: "dailyLimitReached" });

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
    ).resolves.toMatchObject({ startedAt: null, status: "planned" });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blocks[0]?.id } }),
    ).resolves.toMatchObject({ startedAt: null, status: "pending" });

    await expect(ledgerCount(session.id)).resolves.toBe(0);
  });

  it("lets the learner resume active work at the limit without a second session start", async () => {
    const { blocks, session, user } = await setup();

    const input = {
      blockId: blocks[0]?.id ?? "",
      input: { timeZone: "UTC" },
      sessionId: session.id,
    };

    const started = await startStudyBlock(input);
    expect(started.status).toBe("ready");
    await reachLimit(user.id);
    await expect(startStudyBlock(input)).resolves.toStrictEqual(started);
    await expect(ledgerCount(session.id)).resolves.toBe(1);
  });

  it("opens one session ledger and snapshot when different blocks start together", async () => {
    const { blocks, session } = await setup();

    const results = await Promise.all(
      blocks.map((block) =>
        startStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id }),
      ),
    );

    expect(results.map((result) => result.status)).toStrictEqual(["ready", "ready"]);

    const opened = await prisma.studySession.findUniqueOrThrow({
      include: { blocks: true },
      where: { id: session.id },
    });

    expect(opened.status).toBe("active");
    expect(opened.startedAt).not.toBeNull();
    expect(opened.startSnapshot).not.toBeNull();
    expect(opened.blocks.map((block) => block.status)).toStrictEqual(["active", "active"]);
    await expect(ledgerCount(session.id)).resolves.toBe(1);
  });
});
