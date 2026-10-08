import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  setupPlayableLesson,
  stepOfKind,
} from "../lesson-player/_test-utils/playable-lesson-setup";
import { checkLessonStep } from "../lesson-player/check-lesson-step";
import { completeLibraryLesson } from "../lesson-player/complete-library-lesson";
import { startLibraryLesson } from "../lesson-player/start-library-lesson";
import { getStudySession } from "./get-study-session";
import { getTodayStudySession } from "./get-today-study-session";
import { startStudyBlock } from "./start-study-block";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(),
}));

const TIME_ZONE = "UTC";
const BEFORE_MIDNIGHT = new Date("2026-09-30T23:50:00Z");
const AFTER_MIDNIGHT = new Date("2026-10-01T00:05:00Z");
const NEXT_MORNING = new Date("2026-10-01T08:00:00Z");

async function readToday(goalId: string) {
  const today = await getTodayStudySession({ goalId, timeZone: TIME_ZONE });

  if (today.status !== "ready") {
    throw new Error(`Expected today's session, got ${today.status}`);
  }

  return today.session;
}

/**
 * A learner who starts tonight's first lesson at 23:50, with a second lesson after it in the
 * session, then plays the first lesson's only question.
 */
async function startLessonBeforeMidnight() {
  vi.setSystemTime(BEFORE_MIDNIGHT);

  const { lesson, steps, user } = await setupPlayableLesson({
    steps: ["hook", "explanation", "check", "summary"],
  });

  const [goal, second] = await Promise.all([
    goalFixture({ dailyMinutes: 30, timezone: TIME_ZONE, userId: user.id }),
    libraryLessonFixture({ title: "Second lesson" }),
  ]);

  const plan = await planFixture({ goalId: goal.id });

  await Promise.all(
    [lesson, second].map((row, position) =>
      planItemFixture({
        kind: "lesson",
        lessonId: row.id,
        planId: plan.id,
        position,
        titleSnapshot: row.title,
      }),
    ),
  );

  const session = await readToday(goal.id);
  const block = session.blocks.find((candidate) => candidate.lessonId === lesson.id);

  await startStudyBlock({
    blockId: block?.id ?? "",
    input: { timeZone: TIME_ZONE },
    sessionId: session.id,
  });

  const started = await startLibraryLesson({ input: { timeZone: TIME_ZONE }, lessonId: lesson.id });
  const runId = started.status === "started" ? started.run.runId : "";

  await checkLessonStep({
    input: {
      answer: { kind: "check", optionId: "likely" },
      durationMs: 4000,
      runId,
      timeZone: TIME_ZONE,
    },
    stepId: stepOfKind(steps, "check").id,
  });

  return { blockId: block?.id ?? "", goal, lesson, runId, second, session };
}

describe("a session the learner is in when midnight comes", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("finishes the lesson started before midnight as its block, and stays today's session", async () => {
    const { blockId, goal, lesson, runId, second, session } = await startLessonBeforeMidnight();

    vi.setSystemTime(AFTER_MIDNIGHT);

    const outcome = await completeLibraryLesson({
      input: { runId, timeZone: TIME_ZONE },
      lessonId: lesson.id,
    });

    expect(outcome).toMatchObject({
      completion: { studyBlock: { blockId, sessionCompleted: false } },
      status: "completed",
    });

    // Today keeps the session the learner is in, so "Continue" opens its next lesson.
    const today = await readToday(goal.id);
    const next = today.blocks.find((block) => block.id === today.nextBlockId);

    expect(today.id).toBe(session.id);
    expect(today.current).toBe(true);
    expect(next?.lessonId).toBe(second.id);

    await expect(
      prisma.studySession.count({ where: { goalId: goal.id, id: { not: session.id } } }),
    ).resolves.toBe(0);
  });

  it("gives way to the new day once the learner has been away, and says the old one is over", async () => {
    const { goal, session } = await startLessonBeforeMidnight();

    vi.setSystemTime(NEXT_MORNING);

    const today = await readToday(goal.id);

    const yesterday = await getStudySession({
      input: { timeZone: TIME_ZONE },
      sessionId: session.id,
    });

    expect(today.id).not.toBe(session.id);
    expect(today.localDate).toStrictEqual(new Date("2026-10-01T00:00:00Z"));
    expect(today.current).toBe(true);
    expect(yesterday).toMatchObject({ session: { current: false }, status: "ready" });
  });
});
