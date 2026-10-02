import { isRateLimited } from "@zoonk/auth/rate-limit";
import { prisma } from "@zoonk/db";
import {
  CHALLENGE_STRONG_PATH,
  CHALLENGE_WEAK_PATH,
} from "@zoonk/testing/fixtures/challenge-contents";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  setupPlayableLesson,
  stepOfKind,
} from "../../lesson-player/_test-utils/playable-lesson-setup";
import { checkLessonStep } from "../../lesson-player/check-lesson-step";
import { completeLibraryLesson } from "../../lesson-player/complete-library-lesson";
import { getPlayableLibraryLesson } from "../../lesson-player/get-playable-library-lesson";
import { startLibraryLesson } from "../../lesson-player/start-library-lesson";
import type * as RateLimit from "@zoonk/auth/rate-limit";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

vi.mock("@zoonk/auth/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof RateLimit>()),
  isRateLimited: vi.fn(),
}));

const TIME_ZONE = "UTC";

async function playChallenge(choiceIds: string[]) {
  const setup = await setupPlayableLesson({ steps: ["challenge"] });

  const started = await startLibraryLesson({
    input: { timeZone: TIME_ZONE },
    lessonId: setup.lesson.id,
  });

  if (started.status !== "started") {
    throw new Error(`Expected a started run, got ${started.status}`);
  }

  const { runId } = started.run;
  const step = stepOfKind(setup.steps, "challenge");

  const checked = await checkLessonStep({
    input: {
      answer: { choiceIds, kind: "challenge" },
      durationMs: 120_000,
      runId,
      timeZone: TIME_ZONE,
    },
    stepId: step.id,
  });

  return { ...setup, checked, runId, step };
}

describe("playing a challenge lesson", () => {
  beforeEach(() => {
    vi.mocked(isRateLimited).mockResolvedValue(false);
  });

  it("serves the case as a playable screen", async () => {
    const { lesson } = await setupPlayableLesson({ steps: ["challenge"] });
    const result = await getPlayableLibraryLesson({ lessonId: lesson.id });

    expect(
      result?.status === "ready" && result.lesson.steps.map((step) => step.kind),
    ).toStrictEqual(["challenge"]);
  });

  it("records a strong path as right with its score and the ending as the why", async () => {
    const { checked, lesson, runId, step, user } = await playChallenge(CHALLENGE_STRONG_PATH);

    expect(checked).toMatchObject({
      result: {
        feedback: "Version B went to everyone: 3.1% → 3.7%, or 19% more purchases per visit.",
        isCorrect: true,
        savedMistake: false,
        score: 1,
      },
      status: "checked",
    });

    await expect(
      prisma.attempt.findFirstOrThrow({ where: { stepId: step.id, userId: user.id } }),
    ).resolves.toMatchObject({
      answer: { choiceIds: CHALLENGE_STRONG_PATH, kind: "challenge" },
      isCorrect: true,
      score: 1,
    });

    await expect(
      completeLibraryLesson({ input: { runId, timeZone: TIME_ZONE }, lessonId: lesson.id }),
    ).resolves.toMatchObject({
      completion: { correctCount: 1, incorrectCount: 0 },
      status: "completed",
    });
  });

  it("lets a weak path finish the lesson without a mistakes notebook entry", async () => {
    const { checked, lesson, runId, user } = await playChallenge(CHALLENGE_WEAK_PATH);

    expect(checked).toMatchObject({ result: { isCorrect: false, savedMistake: false, score: 0 } });

    await expect(prisma.mistake.count({ where: { userId: user.id } })).resolves.toBe(0);

    await expect(
      completeLibraryLesson({ input: { runId, timeZone: TIME_ZONE }, lessonId: lesson.id }),
    ).resolves.toMatchObject({
      completion: { correctCount: 0, incorrectCount: 1 },
      status: "completed",
    });
  });

  it("refuses a path that doesn't end", async () => {
    const { checked } = await playChallenge(["ask-ai"]);

    expect(checked).toStrictEqual({ status: "invalid" });
  });
});
