import { randomUUID } from "node:crypto";
import { gradeTypedAnswer } from "@zoonk/ai/tasks/grading/grade-typed-answer";
import { prisma } from "@zoonk/db";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import {
  languageLessonFixture,
  playableLessonFixture,
} from "@zoonk/testing/fixtures/playable-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import { setupPlayableLesson, stepOfKind } from "./_test-utils/playable-lesson-setup";
import { checkLessonStep } from "./check-lesson-step";
import { completeLibraryLesson } from "./complete-library-lesson";
import { startLibraryLesson } from "./start-library-lesson";

const TIME_ZONE = "UTC";

async function startRun(lessonId: string) {
  const outcome = await startLibraryLesson({ input: { timeZone: TIME_ZONE }, lessonId });

  if (outcome.status !== "started") {
    throw new Error(`Expected a started run, got ${outcome.status}`);
  }

  return outcome.run.runId;
}

describe("non-language open-answer skips", () => {
  it("records don't-know screens on a completed run without grading or answer verdicts, only for that run", async () => {
    const setup = await setupPlayableLesson({ steps: ["typedAnswer", "typedAnswer", "summary"] });
    const runId = await startRun(setup.lesson.id);

    const skippedWritingStepIds = setup.steps
      .filter((step) => step.kind === "typedAnswer")
      .map((step) => step.id);

    const input = { runId, skippedWritingStepIds, timeZone: TIME_ZONE };

    const [outcome, raced] = await Promise.all([
      completeLibraryLesson({ input, lessonId: setup.lesson.id }),
      completeLibraryLesson({ input, lessonId: setup.lesson.id }),
    ]);

    expect(raced).toStrictEqual(outcome);

    expect(outcome).toMatchObject({
      completion: { brainPower: 10, correctCount: 0, incorrectCount: 0 },
      status: "completed",
    });

    const run = await prisma.learningEvent.findUniqueOrThrow({ where: { id: runId } });

    expect(run).toMatchObject({
      contentIds: { lessonId: setup.lesson.id, skippedWritingStepIds },
      endedAt: expect.any(Date),
    });

    expect(gradeTypedAnswer).not.toHaveBeenCalled();
    await expect(prisma.attempt.count({ where: { userId: setup.user.id } })).resolves.toBe(0);
    await expect(prisma.mistake.count({ where: { userId: setup.user.id } })).resolves.toBe(0);

    await expect(
      prisma.learnerSkill.findMany({ where: { userId: setup.user.id } }),
    ).resolves.toMatchObject([{ helpedAt: run.endedAt, reps: 0, skillId: setup.skill.id }]);

    await expect(
      completeLibraryLesson({ input: { runId, timeZone: TIME_ZONE }, lessonId: setup.lesson.id }),
    ).resolves.toStrictEqual(outcome);

    await expect(
      prisma.dailyProgress.findFirstOrThrow({ where: { userId: setup.user.id } }),
    ).resolves.toMatchObject({ correctAnswers: 0, incorrectAnswers: 0, lessonsCompleted: 1 });

    const nextRunId = await startRun(setup.lesson.id);

    await expect(
      completeLibraryLesson({
        input: { runId: nextRunId, timeZone: TIME_ZONE },
        lessonId: setup.lesson.id,
      }),
    ).resolves.toStrictEqual({ status: "invalid" });
  });

  it("keeps a skipped screen on a run that finished its day's block", async () => {
    freezeClock();
    vi.setSystemTime(new Date("2026-09-30T15:00:00Z"));
    const setup = await setupPlayableLesson({ steps: ["typedAnswer", "summary"] });
    const goal = await goalFixture({ timezone: TIME_ZONE, userId: setup.user.id });

    await planFixture({
      goalId: goal.id,
      items: [
        { lessonId: setup.lesson.id, skillId: setup.skill.id },
        { kind: "boss", position: 100, status: "done" },
      ],
    });

    const runId = await startRun(setup.lesson.id);
    const skippedWritingStepIds = [stepOfKind(setup.steps, "typedAnswer").id];

    await expect(
      completeLibraryLesson({
        input: { runId, skippedWritingStepIds, timeZone: TIME_ZONE },
        lessonId: setup.lesson.id,
      }),
    ).resolves.toMatchObject({ completion: { studyBlock: { sessionCompleted: true } } });

    await expect(
      prisma.learningEvent.findUniqueOrThrow({ where: { id: runId } }),
    ).resolves.toMatchObject({
      contentIds: { skippedWritingStepIds, studySessionBlockId: expect.any(String) },
    });
  });

  it("skips only the named screen and keeps recorded answers in the completion tally", async () => {
    const setup = await setupPlayableLesson({ steps: ["check", "typedAnswer", "typedAnswer"] });
    const runId = await startRun(setup.lesson.id);
    const writing = setup.steps.filter((step) => step.kind === "typedAnswer");
    const input = { runId, skippedWritingStepIds: [writing[0]!.id], timeZone: TIME_ZONE };

    await checkLessonStep({
      input: {
        answer: { kind: "check", optionId: "path" },
        durationMs: 5000,
        runId,
        timeZone: TIME_ZONE,
      },
      stepId: stepOfKind(setup.steps, "check").id,
    });

    await expect(
      completeLibraryLesson({ input, lessonId: setup.lesson.id }),
    ).resolves.toStrictEqual({ status: "invalid" });

    await expect(
      prisma.learningEvent.findUniqueOrThrow({ where: { id: runId } }),
    ).resolves.toMatchObject({ contentIds: { lessonId: setup.lesson.id }, endedAt: null });

    await checkLessonStep({
      input: {
        answer: { kind: "typedAnswer", text: "It shows where the electron is likely to be" },
        durationMs: 5000,
        runId,
        timeZone: TIME_ZONE,
      },
      stepId: writing[1]!.id,
    });

    await expect(
      completeLibraryLesson({ input, lessonId: setup.lesson.id }),
    ).resolves.toMatchObject({
      completion: { correctCount: 1, incorrectCount: 1 },
      status: "completed",
    });

    await expect(
      prisma.attempt.count({ where: { stepId: writing[0]!.id, userId: setup.user.id } }),
    ).resolves.toBe(0);

    await expect(
      prisma.learningEvent.findUniqueOrThrow({ where: { id: runId } }),
    ).resolves.toMatchObject({ contentIds: { skippedWritingStepIds: [writing[0]!.id] } });
  });

  it("rejects non-writing, unknown and other-lesson screen IDs without closing the run", async () => {
    const setup = await setupPlayableLesson({ steps: ["check", "activity", "typedAnswer"] });
    const other = await playableLessonFixture({ steps: ["typedAnswer"] });
    const runId = await startRun(setup.lesson.id);

    for (const id of [
      stepOfKind(setup.steps, "check").id,
      stepOfKind(setup.steps, "activity").id,
      randomUUID(),
      other.steps[0]!.id,
    ]) {
      // oxlint-disable-next-line no-await-in-loop -- each rejected payload must leave the same run open
      await expect(
        completeLibraryLesson({
          input: { runId, skippedWritingStepIds: [id], timeZone: TIME_ZONE },
          lessonId: setup.lesson.id,
        }),
      ).resolves.toStrictEqual({ status: "invalid" });
    }

    await expect(
      prisma.learningEvent.findUniqueOrThrow({ where: { id: runId } }),
    ).resolves.toMatchObject({ endedAt: null });

    expect(gradeTypedAnswer).not.toHaveBeenCalled();
  });
});

describe("dictations", () => {
  it("finishes a lesson whose sentence that is its own answer was left out", async () => {
    const [user, { lesson, steps }] = await Promise.all([
      userFixture(),
      languageLessonFixture({
        language: "en",
        sentenceAudioUrl: "https://audio.zoonk.test/en-rent.mp3",
        sentenceTranslation: "How much is the rent?",
        wordTranslation: "rent",
      }),
    ]);

    mockSession(user.id);
    const runId = await startRun(lesson.id);

    await checkLessonStep({
      input: {
        answer: { kind: "spokenAnswer", text: "How much is the rent?" },
        durationMs: 5000,
        runId,
        timeZone: TIME_ZONE,
      },
      stepId: stepOfKind(steps, "spokenAnswer").id,
    });

    await expect(
      completeLibraryLesson({ input: { runId, timeZone: TIME_ZONE }, lessonId: lesson.id }),
    ).resolves.toMatchObject({ status: "completed" });
  });
});

describe("speaking screens", () => {
  it("finishes a lesson whose speaking screen the learner couldn't answer aloud, and counts one they answered", async () => {
    const left = await setupPlayableLesson({ steps: ["check", "spokenAnswer", "summary"] });
    const leftRunId = await startRun(left.lesson.id);

    await checkLessonStep({
      input: {
        answer: { kind: "check", optionId: "path" },
        durationMs: 5000,
        runId: leftRunId,
        timeZone: TIME_ZONE,
      },
      stepId: stepOfKind(left.steps, "check").id,
    });

    await expect(
      completeLibraryLesson({
        input: { runId: leftRunId, timeZone: TIME_ZONE },
        lessonId: left.lesson.id,
      }),
    ).resolves.toMatchObject({ completion: { incorrectCount: 1 }, status: "completed" });

    const answered = await setupPlayableLesson({ steps: ["spokenAnswer", "summary"] });
    const answeredRunId = await startRun(answered.lesson.id);
    const spoken = stepOfKind(answered.steps, "spokenAnswer");

    await checkLessonStep({
      input: {
        answer: { kind: "spokenAnswer", text: "The electron is a cloud" },
        durationMs: 5000,
        runId: answeredRunId,
        timeZone: TIME_ZONE,
      },
      stepId: spoken.id,
    });

    await expect(
      completeLibraryLesson({
        input: { runId: answeredRunId, timeZone: TIME_ZONE },
        lessonId: answered.lesson.id,
      }),
    ).resolves.toMatchObject({ completion: { correctCount: 1 }, status: "completed" });
  });
});
