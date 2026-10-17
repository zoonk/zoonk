import { prisma } from "@zoonk/db";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { after } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { settleQuestionBlock } from "./_utils/settle-question-block";
import { settleSessionDay } from "./_utils/settle-session-day";
import { answerStudyQuestion } from "./answer-study-question";
import { toBlockPayload } from "./block-payload";
import { finishStudyBlock } from "./finish-study-block";
import { startStudyBlock } from "./start-study-block";

async function setup() {
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
  const { goal, plan } = await unplannedGoalFixture({ timezone: "UTC", userId: user.id });
  const item = await itemFixture({ content: choiceItemContent(), skillId: skill.id });

  const session = await studySessionFixture({
    goalId: goal.id,
    plannedMinutes: 3,
    userId: user.id,
  });

  const block = await studySessionBlockFixture({
    estimatedMinutes: 3,
    kind: "practice",
    payload: toBlockPayload({ itemIds: [item.id], skillIds: [skill.id] }),
    sessionId: session.id,
  });

  mockSession(user.id);

  await expect(
    startStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id }),
  ).resolves.toMatchObject({ status: "ready" });

  await expect(
    answerStudyQuestion({
      blockId: block.id,
      input: { answer: { selectedIndex: 0 }, durationMs: 1000, itemId: item.id, timeZone: "UTC" },
      sessionId: session.id,
    }),
  ).resolves.toMatchObject({ status: "ready" });

  return { block, plan, session, user };
}

function finish({ block, session }: Awaited<ReturnType<typeof setup>>) {
  return finishStudyBlock({ blockId: block.id, input: { timeZone: "UTC" }, sessionId: session.id });
}

async function readVersions({ plan, user }: Awaited<ReturnType<typeof setup>>) {
  const [saved, actor] = await Promise.all([
    prisma.plan.findUniqueOrThrow({ where: { id: plan.id } }),
    prisma.user.findUniqueOrThrow({ where: { id: user.id } }),
  ]);

  return { inputVersion: saved.inputVersion, learnerRevision: actor.learnerRevision };
}

describe("only the session completion transition changes plan inputs", () => {
  afterEach(() => {
    vi.mocked(after).mockReset();
  });

  it("a duplicate completion leaves the real deferred work's input version intact", async () => {
    const day = await setup();
    // Hold only Next's after-response boundary; every completion and revision write is real.
    const scheduled = vi.mocked(after).mockClear();

    await expect(finish(day)).resolves.toMatchObject({
      completion: { sessionCompleted: true },
      status: "ready",
    });

    const beforeRetry = await readVersions(day);
    const deferred = scheduled.mock.calls.length;
    expect(deferred).toBeGreaterThan(0);

    await expect(finish(day)).resolves.toMatchObject({ status: "blockFinished" });

    await expect(readVersions(day)).resolves.toStrictEqual(beforeRetry);
    expect(scheduled).toHaveBeenCalledTimes(deferred);

    await expect(
      prisma.learningEvent.count({
        where: {
          contentIds: { equals: day.session.id, path: ["studySessionId"] },
          kind: "session",
          userId: day.user.id,
        },
      }),
    ).resolves.toBe(1);
  });

  it("concurrent completions commit one revision mark and one end ledger", async () => {
    const day = await setup();

    const session = await prisma.studySession.findUniqueOrThrow({
      include: { blocks: true, goal: true },
      where: { id: day.session.id },
    });

    await expect(
      settleQuestionBlock({ block: day.block, session, timeZone: "UTC", userId: day.user.id }),
    ).resolves.toMatchObject({ status: "ready" });

    const before = await readVersions(day);
    const scheduled = vi.mocked(after).mockClear();

    const request = { sessionId: day.session.id, timeZone: "UTC", userId: day.user.id };
    const results = await Promise.all([settleSessionDay(request), settleSessionDay(request)]);
    expect(results.every((result) => result.sessionCompleted)).toBe(true);

    await expect(readVersions(day)).resolves.toStrictEqual({
      inputVersion: before.inputVersion + 1,
      learnerRevision: before.learnerRevision + 1n,
    });

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: day.session.id } }),
    ).resolves.toMatchObject({ status: "completed" });

    await expect(
      prisma.learningEvent.count({
        where: {
          contentIds: { equals: day.session.id, path: ["studySessionId"] },
          kind: "session",
          userId: day.user.id,
        },
      }),
    ).resolves.toBe(1);
    // One completion telemetry callback, one memory callback and one deferred plan write.
    expect(scheduled).toHaveBeenCalledTimes(3);
  });
});
