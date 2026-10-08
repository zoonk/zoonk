import { randomUUID } from "node:crypto";
import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { mockSession } from "../_test-utils/mock-session";
import { trackServerEvent } from "../analytics/server";
import { saveLessonVersion } from "../library/lessons/_utils/save-lesson-content";
import { lessonRunFixture } from "./_test-utils/lesson-run-fixture";
import { setupPlayableLesson, stepOfKind } from "./_test-utils/playable-lesson-setup";
import { checkLessonStep } from "./check-lesson-step";
import { completeLibraryLesson } from "./complete-library-lesson";
import { type LessonStepAnswer } from "./contract";
import { getPlayableLibraryLesson } from "./get-playable-library-lesson";
import { startLibraryLesson } from "./start-library-lesson";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// PostHog is an external service; the mock records what would leave the server.
vi.mock("../analytics/server", () => ({ trackServerEvent: vi.fn() }));

/** The Vercel Firewall only answers on Vercel, so tests stand in for the adapter that asks it. */
vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(),
}));

const TIME_ZONE = "UTC";

/**
 * Brain Power v2: 2 points per right answer on a new question times Hyperdrive (x1, then x2 in a
 * row), a replayed question 1, and 10 for finishing a lesson the first time.
 */
const MISSED_THEN_RIGHT = 2 + 10;
const BOTH_RIGHT = 2 + 4 + 10;
const REPLAYED_BOTH_RIGHT = 1 + 1;

/** Two right answers earlier in the session: the lesson's answers continue at x3 and x4. */
const BOTH_RIGHT_IN_SESSION = 2 * 3 + 2 * 4 + 10;
const LESSON = ["hook", "explanation", "check", "typedAnswer", "summary"] as const;
const RIGHT_TYPED = "It shows where the electron is likely to be";

async function startRun(lessonId: string, studySessionId?: string): Promise<string> {
  const outcome = await startLibraryLesson({
    input: { studySessionId, timeZone: TIME_ZONE },
    lessonId,
  });

  if (outcome.status !== "started") {
    throw new Error(`Expected a started run, got ${outcome.status}`);
  }

  return outcome.run.runId;
}

function answer({
  runId,
  stepId,
  value,
}: {
  runId: string;
  stepId: string;
  value: LessonStepAnswer;
}) {
  return checkLessonStep({
    input: { answer: value, durationMs: 5000, runId, timeZone: TIME_ZONE },
    stepId,
  });
}

function complete({ lessonId, runId }: { lessonId: string; runId: string }) {
  return completeLibraryLesson({ input: { runId, timeZone: TIME_ZONE }, lessonId });
}

async function playLesson({ checkOption = "likely" }: { checkOption?: string } = {}) {
  const setup = await setupPlayableLesson({ steps: [...LESSON] });
  const runId = await startRun(setup.lesson.id);

  await answer({
    runId,
    stepId: stepOfKind(setup.steps, "check").id,
    value: { kind: "check", optionId: checkOption },
  });

  await answer({
    runId,
    stepId: stepOfKind(setup.steps, "typedAnswer").id,
    value: { kind: "typedAnswer", text: RIGHT_TYPED },
  });

  return { ...setup, runId };
}

describe(completeLibraryLesson, () => {
  beforeEach(() => {
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  it("closes the run and adds Brain Power, Energy and the day's first completion", async () => {
    const { lesson, runId, user } = await playLesson({ checkOption: "path" });

    const outcome = await complete({ lessonId: lesson.id, runId });

    expect(outcome).toMatchObject({
      completion: {
        brainPower: MISSED_THEN_RIGHT,
        correctCount: 1,
        incorrectCount: 1,
        isFirstCompletion: true,
        studyBlock: null,
        totalBrainPower: MISSED_THEN_RIGHT,
      },
      status: "completed",
    });

    expect(outcome.status === "completed" && typeof outcome.completion.nextReviewAt).toBe("string");

    const [run, day] = await Promise.all([
      prisma.learningEvent.findUniqueOrThrow({ where: { id: runId } }),
      prisma.dailyProgress.findFirstOrThrow({ where: { userId: user.id } }),
    ]);

    expect(run).toMatchObject({
      brainPower: MISSED_THEN_RIGHT,
      correctAnswers: 1,
      endedAt: expect.any(Date),
      incorrectAnswers: 1,
      kind: "lesson",
    });

    expect(day).toMatchObject({
      brainPowerEarned: MISSED_THEN_RIGHT,
      correctAnswers: 1,
      incorrectAnswers: 1,
      interactiveCompleted: 1,
      lessonsCompleted: 1,
    });
  });

  it("continues the session's Hyperdrive when the lesson is one of its blocks", async () => {
    const setup = await setupPlayableLesson({ steps: [...LESSON] });
    const earlier = await playableLessonFixture({ steps: ["check", "typedAnswer"] });
    const session = await studySessionFixture({ userId: setup.user.id });
    await studySessionBlockFixture({ lessonId: setup.lesson.id, sessionId: session.id });

    await Promise.all(
      earlier.steps.map((step, index) =>
        attemptFixture({
          answeredAt: new Date(Date.now() - (10 - index) * 1000),
          stepId: step.id,
          studySessionId: session.id,
          userId: setup.user.id,
        }),
      ),
    );

    const runId = await startRun(setup.lesson.id, session.id);

    await answer({
      runId,
      stepId: stepOfKind(setup.steps, "check").id,
      value: { kind: "check", optionId: "likely" },
    });

    await answer({
      runId,
      stepId: stepOfKind(setup.steps, "typedAnswer").id,
      value: { kind: "typedAnswer", text: RIGHT_TYPED },
    });

    const outcome = await complete({ lessonId: setup.lesson.id, runId });

    expect(outcome).toMatchObject({
      completion: { brainPower: BOTH_RIGHT_IN_SESSION },
      status: "completed",
    });
  });

  it("finishes a lesson left unfinished yesterday, counting both sittings, Hyperdrive in each", async () => {
    const setup = await setupPlayableLesson({ steps: [...LESSON] });
    const leftAt = new Date(Date.now() - MS_PER_DAY);

    await lessonRunFixture({ lessonId: setup.lesson.id, startedAt: leftAt, userId: setup.user.id });

    await attemptFixture({
      answeredAt: new Date(leftAt.getTime() + 1000),
      stepId: stepOfKind(setup.steps, "check").id,
      userId: setup.user.id,
    });

    const runId = await startRun(setup.lesson.id);

    await answer({
      runId,
      stepId: stepOfKind(setup.steps, "typedAnswer").id,
      value: { kind: "typedAnswer", text: RIGHT_TYPED },
    });

    // Yesterday's right answer doesn't multiply today's: x1 in each sitting.
    await expect(complete({ lessonId: setup.lesson.id, runId })).resolves.toMatchObject({
      completion: { brainPower: 2 + 2 + 10, correctCount: 2, incorrectCount: 0 },
      status: "completed",
    });
  });

  it("counts a screen once, by its first answer, when a missed question comes back", async () => {
    const { lesson, runId, steps } = await playLesson({ checkOption: "size" });

    await answer({
      runId,
      stepId: stepOfKind(steps, "check").id,
      value: { kind: "check", optionId: "likely" },
    });

    await expect(complete({ lessonId: lesson.id, runId })).resolves.toMatchObject({
      completion: { correctCount: 1, incorrectCount: 1 },
    });
  });

  it("refuses a run with an unanswered screen", async () => {
    const setup = await setupPlayableLesson({ steps: [...LESSON] });
    const runId = await startRun(setup.lesson.id);

    await answer({
      runId,
      stepId: stepOfKind(setup.steps, "typedAnswer").id,
      value: { kind: "typedAnswer", text: RIGHT_TYPED },
    });

    await expect(complete({ lessonId: setup.lesson.id, runId })).resolves.toStrictEqual({
      status: "invalid",
    });
  });

  it('accepts "I know this": every check right, the rest skipped', async () => {
    const setup = await setupPlayableLesson({ steps: [...LESSON] });
    const runId = await startRun(setup.lesson.id);

    await answer({
      runId,
      stepId: stepOfKind(setup.steps, "check").id,
      value: { kind: "check", optionId: "likely" },
    });

    await expect(complete({ lessonId: setup.lesson.id, runId })).resolves.toMatchObject({
      completion: { correctCount: 1, incorrectCount: 0, isFirstCompletion: true },
      status: "completed",
    });
  });

  it("returns the same result when the completion is repeated, counting it once", async () => {
    const { lesson, runId, user } = await playLesson();

    const [first, second] = await Promise.all([
      complete({ lessonId: lesson.id, runId }),
      complete({ lessonId: lesson.id, runId }),
    ]);

    const third = await complete({ lessonId: lesson.id, runId });

    expect(first).toStrictEqual(second);
    expect(third).toStrictEqual(first);

    const [progress, day] = await Promise.all([
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
      prisma.dailyProgress.findFirstOrThrow({ where: { userId: user.id } }),
    ]);

    expect(Number(progress.totalBrainPower)).toBe(BOTH_RIGHT);
    expect(day.lessonsCompleted).toBe(1);
  });

  it("records a replay as a review that doesn't add a lesson to the day", async () => {
    const { lesson, runId, steps, user } = await playLesson();
    await complete({ lessonId: lesson.id, runId });

    const replayRunId = await startRun(lesson.id);

    await Promise.all(
      [
        { answer: { kind: "check", optionId: "likely" } as const, kind: "check" },
        { answer: { kind: "typedAnswer", text: RIGHT_TYPED } as const, kind: "typedAnswer" },
      ].map((item) =>
        answer({ runId: replayRunId, stepId: stepOfKind(steps, item.kind).id, value: item.answer }),
      ),
    );

    const replay = await complete({ lessonId: lesson.id, runId: replayRunId });

    expect(replay).toMatchObject({
      completion: { isFirstCompletion: false, totalBrainPower: BOTH_RIGHT + REPLAYED_BOTH_RIGHT },
    });

    const [run, day] = await Promise.all([
      prisma.learningEvent.findUniqueOrThrow({ where: { id: replayRunId } }),
      prisma.dailyProgress.findFirstOrThrow({ where: { userId: user.id } }),
    ]);

    expect(run.kind).toBe("review");
    expect(day.lessonsCompleted).toBe(1);
  });

  it('sends "Lesson Completed" once per closed run, telling a first finish from a replay', async () => {
    const flush = runDeferredWork();
    const { lesson, runId, steps } = await playLesson();

    await Promise.all([
      complete({ lessonId: lesson.id, runId }),
      complete({ lessonId: lesson.id, runId }),
    ]);

    const replayRunId = await startRun(lesson.id);

    await answer({
      runId: replayRunId,
      stepId: stepOfKind(steps, "check").id,
      value: { kind: "check", optionId: "likely" },
    });

    await answer({
      runId: replayRunId,
      stepId: stepOfKind(steps, "typedAnswer").id,
      value: { kind: "typedAnswer", text: RIGHT_TYPED },
    });

    await complete({ lessonId: lesson.id, runId: replayRunId });
    await flush();

    const completions = vi
      .mocked(trackServerEvent)
      .mock.calls.flatMap(([event]) =>
        event.name === "Lesson Completed" ? [event.properties] : [],
      );

    expect(completions).toStrictEqual([
      expect.objectContaining({
        first_completion: true,
        lessonKind: "library",
        lesson_id: lesson.id,
      }),
      expect.objectContaining({ first_completion: false, lesson_id: lesson.id }),
    ]);
  });

  it("completes a guest's run", async () => {
    const setup = await setupPlayableLesson({ guest: true, steps: ["explanation", "check"] });
    const runId = await startRun(setup.lesson.id);

    await answer({
      runId,
      stepId: stepOfKind(setup.steps, "check").id,
      value: { kind: "check", optionId: "likely" },
    });

    await expect(complete({ lessonId: setup.lesson.id, runId })).resolves.toMatchObject({
      status: "completed",
    });
  });

  it("never says when a quick explanation comes back, since nothing reviews it", async () => {
    const setup = await setupPlayableLesson({ steps: ["explanation", "check"] });
    const goal = await goalFixture({ kind: "explain", userId: setup.user.id });
    const plan = await planFixture({ goalId: goal.id });
    await planItemFixture({ kind: "lesson", lessonId: setup.lesson.id, planId: plan.id });

    const runId = await startRun(setup.lesson.id);

    const checked = await answer({
      runId,
      stepId: stepOfKind(setup.steps, "check").id,
      value: { kind: "check", optionId: "likely" },
    });

    expect(checked).toMatchObject({ result: { nextReviewAt: null }, status: "checked" });

    await expect(complete({ lessonId: setup.lesson.id, runId })).resolves.toMatchObject({
      completion: { nextReviewAt: null },
      status: "completed",
    });

    // The answer still reaches the learner's memory of the skill.
    await expect(
      prisma.learnerSkill.findFirst({ where: { skillId: setup.skill.id, userId: setup.user.id } }),
    ).resolves.toMatchObject({ due: expect.any(Date) });
  });

  it("finishes a quick explanation with its lesson, and the tabs move to a goal with a plan", async () => {
    const setup = await setupPlayableLesson({ steps: ["explanation", "check"] });
    const other = await userFixture();

    const [explanation, study, othersExplanation] = await Promise.all([
      goalFixture({ kind: "explain", userId: setup.user.id }),
      goalFixture({ kind: "learn", userId: setup.user.id }),
      goalFixture({ kind: "explain", userId: other.id }),
    ]);

    const [plan, othersPlan] = await Promise.all([
      planFixture({ goalId: explanation.id }),
      planFixture({ goalId: othersExplanation.id }),
      learningProfileFixture({ activeGoalId: explanation.id, userId: setup.user.id }),
    ]);

    await Promise.all([
      planItemFixture({ kind: "lesson", lessonId: setup.lesson.id, planId: plan.id }),
      planItemFixture({ kind: "lesson", lessonId: setup.lesson.id, planId: othersPlan.id }),
    ]);

    const runId = await startRun(setup.lesson.id);

    await answer({
      runId,
      stepId: stepOfKind(setup.steps, "check").id,
      value: { kind: "check", optionId: "likely" },
    });

    await expect(complete({ lessonId: setup.lesson.id, runId })).resolves.toMatchObject({
      status: "completed",
    });

    const [goals, profile] = await Promise.all([
      prisma.goal.findMany({
        select: { id: true, status: true },
        where: { id: { in: [explanation.id, study.id, othersExplanation.id] } },
      }),
      prisma.userLearningProfile.findUniqueOrThrow({ where: { userId: setup.user.id } }),
    ]);

    // Another learner who asked the same question still has theirs to read.
    expect(goals).toStrictEqual(
      expect.arrayContaining([
        { id: explanation.id, status: "completed" },
        { id: study.id, status: "active" },
        { id: othersExplanation.id, status: "active" },
      ]),
    );

    expect(profile.activeGoalId).toBe(study.id);
  });

  it("finishes the version the learner opened when a check publishes a fix mid-lesson, and the next open gets the fix", async () => {
    const setup = await setupPlayableLesson({ steps: [...LESSON] });
    const runId = await startRun(setup.lesson.id);

    await answer({
      runId,
      stepId: stepOfKind(setup.steps, "check").id,
      value: { kind: "check", optionId: "likely" },
    });

    // A background check publishes a fixed version while the learner is on the next screen.
    const opened = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: setup.lesson.id },
    });

    const fixed = await saveLessonVersion({
      language: setup.lesson.language,
      lessonId: setup.lesson.id,
      replaces: 1,
      screens: opened.map((step) => ({
        content: step.content as object,
        kind: step.kind,
        mathItem: null,
        provenance: { generatedAt: new Date(), model: "fix", promptVersion: "fix", runId: "fix" },
        skillId: step.skillId,
      })),
      summary: ["A fixed idea."],
    });

    expect(fixed).toBe(2);

    // The learner keeps answering the screens they opened, and their run completes.
    await expect(
      answer({
        runId,
        stepId: stepOfKind(setup.steps, "typedAnswer").id,
        value: { kind: "typedAnswer", text: RIGHT_TYPED },
      }),
    ).resolves.toMatchObject({ result: { isCorrect: true }, status: "checked" });

    await expect(complete({ lessonId: setup.lesson.id, runId })).resolves.toMatchObject({
      completion: { brainPower: BOTH_RIGHT, correctCount: 2, incorrectCount: 0 },
      status: "completed",
    });

    // Opening the lesson again plays the fixed version.
    const reopened = await getPlayableLibraryLesson({ lessonId: setup.lesson.id });
    const openedIds = new Set(opened.map((step) => step.id));

    expect(reopened?.status).toBe("ready");

    expect(
      reopened?.status === "ready" &&
        reopened.lesson.steps.every((step) => !openedIds.has(step.id)),
    ).toBe(true);
  });

  it("finishes only the learner's own runs of that lesson", async () => {
    const { lesson, runId, user } = await playLesson();
    const other = await setupPlayableLesson();

    mockSession(user.id);

    await expect(complete({ lessonId: other.lesson.id, runId })).resolves.toStrictEqual({
      status: "notFound",
    });

    const stranger = await userFixture();
    mockSession(stranger.id);

    await expect(complete({ lessonId: lesson.id, runId })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(complete({ lessonId: lesson.id, runId: randomUUID() })).resolves.toStrictEqual({
      status: "notFound",
    });

    mockSession(null);

    await expect(complete({ lessonId: lesson.id, runId })).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });
});
