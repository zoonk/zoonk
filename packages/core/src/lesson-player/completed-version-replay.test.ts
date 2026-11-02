import { prisma } from "@zoonk/db";
import { describe, expect, it, vi } from "vitest";
import { freezeClock } from "../_test-utils/frozen-clock";
import { saveLessonVersion } from "../library/lessons/_utils/save-lesson-content";
import { setupPlayableLesson, stepOfKind } from "./_test-utils/playable-lesson-setup";
import { checkLessonStep } from "./check-lesson-step";
import { completeLibraryLesson } from "./complete-library-lesson";
import { startLibraryLesson } from "./start-library-lesson";

async function startRun(lessonId: string) {
  const result = await startLibraryLesson({ input: { timeZone: "UTC" }, lessonId });

  if (result.status !== "started") {
    throw new Error(`Expected a started run, got ${result.status}`);
  }

  return result.run.runId;
}

describe("completed lesson version replay", () => {
  it.each([
    [false, 0],
    [true, 0],
    [false, 60_000],
    [true, 60_000],
  ] as const)(
    "replays after a later version is answered (earlier choice answer: %s, elapsed ms: %s)",
    async (answerChoice, elapsedMs) => {
      freezeClock();

      const setup = await setupPlayableLesson({
        steps: answerChoice ? ["check", "typedAnswer", "summary"] : ["typedAnswer", "summary"],
      });

      const lessonId = setup.lesson.id;
      const runId = await startRun(lessonId);

      if (answerChoice) {
        const checked = await checkLessonStep({
          input: {
            answer: { kind: "check", optionId: "likely" },
            durationMs: 1000,
            runId,
            timeZone: "UTC",
          },
          stepId: stepOfKind(setup.steps, "check").id,
        });

        if (checked.status !== "checked") {
          throw new Error(`Expected a checked answer, got ${checked.status}`);
        }
      }

      const skippedWritingStepIds = [stepOfKind(setup.steps, "typedAnswer").id];

      const completed = await completeLibraryLesson({
        input: { runId, skippedWritingStepIds, timeZone: "UTC" },
        lessonId,
      });

      if (completed.status !== "completed") {
        throw new Error(`Expected completion, got ${completed.status}`);
      }

      const savedRun = await prisma.learningEvent.findUniqueOrThrow({ where: { id: runId } });

      const expected = {
        completion: {
          brainPower: completed.completion.brainPower,
          correctCount: answerChoice ? 1 : 0,
          energyDelta: completed.completion.energyDelta,
          incorrectCount: 0,
          isFirstCompletion: true,
          seconds: completed.completion.seconds,
          studyBlock: null,
          totalBrainPower: completed.completion.totalBrainPower,
        },
        status: "completed",
      };

      vi.setSystemTime(new Date(Date.now() + elapsedMs));

      await saveLessonVersion({
        language: setup.lesson.language,
        lessonId,
        replaces: 1,
        screens: setup.steps.map((step) => ({
          content: step.content as object,
          kind: step.kind,
          mathItem: null,
          provenance: { generatedAt: new Date(), model: "fix", promptVersion: "fix", runId: "fix" },
          skillId: step.skillId,
        })),
        summary: ["A fixed idea."],
      });

      const laterRunId = await startRun(lessonId);

      const laterStep = await prisma.step.findFirstOrThrow({
        where: { kind: "typedAnswer", lessonId, version: 2 },
      });

      await expect(
        checkLessonStep({
          input: {
            answer: { kind: "typedAnswer", text: "It shows where the electron is likely to be" },
            durationMs: 1000,
            runId: laterRunId,
            timeZone: "UTC",
          },
          stepId: laterStep.id,
        }),
      ).resolves.toMatchObject({ status: "checked" });

      await expect(
        prisma.attempt.findFirstOrThrow({ where: { stepId: laterStep.id, userId: setup.user.id } }),
      ).resolves.toMatchObject({ answeredAt: new Date(), stepId: laterStep.id });

      await expect(
        completeLibraryLesson({ input: { runId, timeZone: "UTC" }, lessonId }),
      ).resolves.toMatchObject(expected);

      await expect(
        completeLibraryLesson({
          input: { runId, skippedWritingStepIds, timeZone: "UTC" },
          lessonId,
        }),
      ).resolves.toMatchObject(expected);

      await expect(
        prisma.learningEvent.findUniqueOrThrow({ where: { id: runId } }),
      ).resolves.toStrictEqual(savedRun);
    },
  );
});
