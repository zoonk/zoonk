import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { answerBlockInOrder } from "./_test-utils/answer-block";
import {
  SESSION_NOW,
  daysAgo,
  dueSkillFixture,
  sessionGoalFixture,
} from "./_test-utils/session-goal";
import { answerStudyQuestion } from "./answer-study-question";
import { BRAIN_POWER_BONUS } from "./brain-power";
import { finishStudyBlock } from "./finish-study-block";
import { getStudyBlock } from "./get-study-block";
import { getTodayStudySession } from "./get-today-study-session";
import { startStudyBlock } from "./start-study-block";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// The classifier is a paid model call; its behavior is covered by its eval.
vi.mock("@zoonk/ai/tasks/v2/mistakes/cause", () => ({ classifyMistakeCause: vi.fn() }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(async () => false),
}));

async function setup() {
  const user = await userFixture();
  const fixture = await sessionGoalFixture({ lessons: 2, userId: user.id });
  const [firstSkill] = fixture.skills;

  const mistake = await mistakeFixture({
    createdAt: daysAgo(1),
    itemId: fixture.items[0]?.id,
    skillId: firstSkill?.id,
    userId: user.id,
  });

  await Promise.all([
    prisma.planItem.update({ data: { status: "done" }, where: { id: fixture.planItems[0]?.id } }),
    dueSkillFixture({ skillId: firstSkill?.id ?? "", userId: user.id }),
  ]);

  mockSession(user.id);
  const result = await getTodayStudySession({ goalId: fixture.goal.id });

  if (result.status !== "ready") {
    throw new Error("Expected today's session");
  }

  return { ...fixture, mistake, session: result.session, user };
}

/** What the lesson player's completion paid for the lesson in these tests. */
const LESSON_POWER = 30;

async function playReview({ blockId, sessionId }: { blockId: string; sessionId: string }) {
  await expect(
    answerStudyQuestion({
      blockId,
      input: { answer: { selectedIndex: 0 }, durationMs: 1000, itemId: crypto.randomUUID() },
      sessionId,
    }),
  ).resolves.toStrictEqual({ status: "blockNotActive" });

  await startStudyBlock({ blockId, input: {}, sessionId });
  const answers = await answerBlockInOrder({ blockId, sessionId });

  expect(answers.at(-1)).toMatchObject({ feedback: { isCorrect: true }, status: "ready" });

  await expect(finishStudyBlock({ blockId, input: {}, sessionId })).resolves.toMatchObject({
    completion: { capsulesOpened: 1, fullMeal: { paid: false }, sessionCompleted: false },
    status: "ready",
  });
}

async function playLesson({
  blockId,
  lessonId,
  sessionId,
  userId,
}: {
  blockId: string;
  lessonId: string;
  sessionId: string;
  userId: string;
}) {
  await startStudyBlock({ blockId, input: {}, sessionId });

  await expect(finishStudyBlock({ blockId, input: {}, sessionId })).resolves.toStrictEqual({
    status: "lessonNotFinished",
  });

  await learningEventFixture({
    brainPower: LESSON_POWER,
    contentIds: { lessonId },
    endedAt: new Date(),
    userId,
  });

  await expect(finishStudyBlock({ blockId, input: {}, sessionId })).resolves.toMatchObject({
    completion: { brainPower: LESSON_POWER, fullMeal: { paid: false } },
    status: "ready",
  });
}

async function playPractice({ blockId, sessionId }: { blockId: string; sessionId: string }) {
  await startStudyBlock({ blockId, input: {}, sessionId });
  const answers = await answerBlockInOrder({ blockId, sessionId });

  expect(answers[0]).toMatchObject({ feedback: { mistakeFixed: true }, status: "ready" });

  await expect(finishStudyBlock({ blockId, input: {}, sessionId })).resolves.toMatchObject({
    completion: { fullMeal: { paid: true }, sessionCompleted: true },
    status: "ready",
  });
}

describe("study session blocks", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("plays capsules, a lesson and a mistake fix into a full meal paid once", async () => {
    const { lessons, mistake, session, user } = await setup();
    const [review, learn, practice] = session.blocks.map((block) => block.id);

    expect(session.blocks.map((block) => block.kind)).toStrictEqual([
      "review",
      "learn",
      "practice",
    ]);

    await playReview({ blockId: review ?? "", sessionId: session.id });

    await playLesson({
      blockId: learn ?? "",
      lessonId: lessons[1]?.id ?? "",
      sessionId: session.id,
      userId: user.id,
    });

    await playPractice({ blockId: practice ?? "", sessionId: session.id });

    const [stored, fixed, events, progress] = await Promise.all([
      prisma.studySession.findUniqueOrThrow({
        include: { blocks: true },
        where: { id: session.id },
      }),
      prisma.mistake.findUniqueOrThrow({ where: { id: mistake.id } }),
      prisma.learningEvent.findMany({ where: { userId: user.id } }),
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
    ]);

    expect(stored.status).toBe("completed");
    expect(stored.fullMealAt).not.toBeNull();
    expect(fixed.status).toBe("fixed");

    const sessionRow = events.find((event) => event.kind === "session");

    expect(sessionRow).toMatchObject({ brainPower: BRAIN_POWER_BONUS.fullMeal });
    expect(sessionRow?.endedAt).not.toBeNull();
    expect(events.filter((event) => event.lessonKind === "capsule")).toHaveLength(1);

    const blocksPower = stored.blocks.reduce((sum, block) => sum + block.brainPower, 0);

    expect(blocksPower).toBeGreaterThan(LESSON_POWER);
    // Lesson Brain Power is added by the lesson's own completion; the session adds the rest.
    expect(Number(progress.totalBrainPower)).toBe(
      blocksPower - LESSON_POWER + BRAIN_POWER_BONUS.fullMeal,
    );
  });

  it("settles a block once and says what's missing before it can finish", async () => {
    const { session, user } = await setup();
    const [review] = session.blocks;
    const blockId = review?.id ?? "";

    await startStudyBlock({ blockId, input: {}, sessionId: session.id });

    await expect(
      finishStudyBlock({ blockId, input: {}, sessionId: session.id }),
    ).resolves.toStrictEqual({ status: "noAnswers" });

    const [first] = await answerBlockInOrder({ blockId, sessionId: session.id });
    expect(first?.status).toBe("ready");

    const detail = await getStudyBlock({ blockId, sessionId: session.id });
    const itemId = detail.status === "ready" ? (detail.detail.questions[0]?.itemId ?? "") : "";

    await expect(
      answerStudyQuestion({
        blockId,
        input: { answer: { selectedIndex: 0 }, durationMs: 1000, itemId },
        sessionId: session.id,
      }),
    ).resolves.toStrictEqual({ status: "alreadyAnswered" });

    const [once, twice] = await Promise.all([
      finishStudyBlock({ blockId, input: {}, sessionId: session.id }),
      finishStudyBlock({ blockId, input: {}, sessionId: session.id }),
    ]);

    expect([once.status, twice.status].toSorted()).toStrictEqual(["blockFinished", "ready"]);

    await expect(
      prisma.learningEvent.count({
        where: { kind: "review", lessonKind: "capsule", userId: user.id },
      }),
    ).resolves.toBe(1);
  });

  it("asks for a short wait at unusual review volume instead of blocking", async () => {
    const { session } = await setup();
    const blockId = session.blocks[0]?.id ?? "";

    await startStudyBlock({ blockId, input: {}, sessionId: session.id });
    vi.mocked(isRateLimited).mockResolvedValueOnce(true);

    const detail = await getStudyBlock({ blockId, sessionId: session.id });
    const itemId = detail.status === "ready" ? (detail.detail.questions[0]?.itemId ?? "") : "";

    await expect(
      answerStudyQuestion({
        blockId,
        input: { answer: { selectedIndex: 0 }, durationMs: 1000, itemId },
        sessionId: session.id,
      }),
    ).resolves.toStrictEqual({ retryAfterSeconds: 60, status: "slowDown" });
  });

  it("keeps sessions private to their learner", async () => {
    const { session } = await setup();
    const stranger = await userFixture();

    mockSession(stranger.id);

    await expect(
      getStudyBlock({ blockId: session.blocks[0]?.id ?? "", sessionId: session.id }),
    ).resolves.toStrictEqual({ status: "notFound" });

    await expect(
      startStudyBlock({ blockId: session.blocks[0]?.id ?? "", input: {}, sessionId: session.id }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});
