import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { findAlternativeStudyBlock } from "./alternative-study-block";
import { toBlockPayload } from "./block-payload";
import { getStudyBlock } from "./get-study-block";
import { getStudySession } from "./get-study-session";
import { startStudyBlock } from "./start-study-block";

const BOSS = {
  kind: "boss",
  mock: false,
  passMark: 0,
  phase: 1,
  rematch: false,
  timeLimitMinutes: null,
} as const;

async function setup() {
  const user = await userFixture();
  const session = await studySessionFixture({ userId: user.id });
  const itemIds = Array.from({ length: 5 }, () => randomUUID());

  const [lesson, boss, final] = await Promise.all([
    studySessionBlockFixture({ kind: "learn", position: 0, sessionId: session.id }),
    studySessionBlockFixture({
      kind: "checkpoint",
      payload: toBlockPayload({ checkpoint: BOSS, itemIds }),
      position: 1,
      sessionId: session.id,
    }),
    studySessionBlockFixture({
      kind: "checkpoint",
      payload: toBlockPayload({ checkpoint: { ...BOSS, kind: "finalBoss" }, itemIds }),
      position: 2,
      sessionId: session.id,
    }),
  ]);

  mockSession(user.id);

  const start = (blockId: string) =>
    startStudyBlock({ blockId, input: { timeZone: "UTC" }, sessionId: session.id });

  return { boss, final, lesson, session, start, user };
}

describe("session phase challenge ordering", () => {
  it("never suggests a waiting phase challenge while its earlier lesson is being written", async () => {
    const { lesson, session } = await setup();
    const view = await getStudySession({ input: {}, sessionId: session.id });

    if (view.status !== "ready") {
      throw new Error(view.status);
    }

    expect(
      findAlternativeStudyBlock({ blockId: lesson.id, blocks: view.session.blocks }),
    ).toBeNull();

    const review = await studySessionBlockFixture({
      kind: "review",
      position: 3,
      sessionId: session.id,
    });

    const refreshed = await getStudySession({ input: {}, sessionId: session.id });

    if (refreshed.status !== "ready") {
      throw new Error(refreshed.status);
    }

    expect(
      findAlternativeStudyBlock({ blockId: lesson.id, blocks: refreshed.session.blocks })?.id,
    ).toBe(review.id);
  });

  it("refuses a phase challenge before earlier lessons without opening it or the session", async () => {
    const { boss, lesson, session, start, user } = await setup();

    await expect(start(boss.id)).resolves.toStrictEqual({
      reason: "lessons",
      status: "earlierFirst",
    });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: boss.id } }),
    ).resolves.toMatchObject({ startedAt: null, status: "pending" });

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
    ).resolves.toMatchObject({ startedAt: null, status: "planned" });

    await expect(
      prisma.learningEvent.count({ where: { kind: "session", userId: user.id } }),
    ).resolves.toBe(0);

    await expect(start(lesson.id)).resolves.toMatchObject({ status: "ready" });

    await expect(start(boss.id)).resolves.toStrictEqual({
      reason: "lessons",
      status: "earlierFirst",
    });

    await prisma.studySessionBlock.update({
      data: { status: "completed" },
      where: { id: lesson.id },
    });

    await expect(start(boss.id)).resolves.toMatchObject({ status: "ready" });
  });

  it("holds a final or rematch for the earlier challenge, allowing done and skipped predecessors", async () => {
    const { boss, final, lesson, start } = await setup();

    await prisma.studySessionBlock.update({
      data: { status: "skipped" },
      where: { id: lesson.id },
    });

    await expect(start(final.id)).resolves.toStrictEqual({
      reason: "challenge",
      status: "earlierFirst",
    });

    await expect(start(boss.id)).resolves.toMatchObject({ status: "ready" });

    await expect(start(final.id)).resolves.toStrictEqual({
      reason: "challenge",
      status: "earlierFirst",
    });

    await prisma.studySessionBlock.update({
      data: { status: "completed" },
      where: { id: boss.id },
    });

    await expect(start(final.id)).resolves.toMatchObject({ status: "ready" });
  });

  it.each([
    { kind: "weekly" as const, mock: false },
    { kind: "weekly" as const, mock: true },
  ])("leaves weekly challenges and mocks free to start before lessons: %j", async (checkpoint) => {
    const { boss, start } = await setup();

    await prisma.studySessionBlock.update({
      data: {
        payload: toBlockPayload({
          checkpoint: { ...BOSS, ...checkpoint },
          itemIds: Array.from({ length: 5 }, () => randomUUID()),
        }),
      },
      where: { id: boss.id },
    });

    await expect(start(boss.id)).resolves.toMatchObject({ status: "ready" });
  });

  it("publishes the same wait reason in the session and individual block views", async () => {
    const { boss, session } = await setup();
    const view = await getStudySession({ input: {}, sessionId: session.id });
    expect(view.status).toBe("ready");

    if (view.status !== "ready") {
      throw new Error(view.status);
    }

    expect(view.session.blocks.find((block) => block.id === boss.id)).toMatchObject({
      waitReason: "lessons",
    });

    await expect(getStudyBlock({ blockId: boss.id, sessionId: session.id })).resolves.toMatchObject(
      { detail: { block: { waitReason: "lessons" } }, status: "ready" },
    );
  });
});
