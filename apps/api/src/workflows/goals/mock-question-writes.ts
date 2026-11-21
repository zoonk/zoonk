import { type MockQuestionWrites } from "@zoonk/core/exams/mocks/prep";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { preparePartSet } from "../listening/steps/listening-sets-steps";
import { voiceListeningRecording } from "../listening/voice-listening-recording";
import { type PlacementItemsWritten } from "./placement-items";
import { prepareSkillExamFormatItems } from "./steps/exam-format-items-step";
import {
  loadMockWritingSkillsStep,
  reportMockSupplyFailureStep,
} from "./steps/mock-question-steps";

function countItemWrites(results: readonly PromiseSettledResult<number>[]): PlacementItemsWritten {
  return {
    failed: results.filter((result) => result.status === "rejected").length,
    written: results.filter((result) => result.status === "fulfilled" && result.value > 0).length,
  };
}

type WriteContext = {
  analytics?: ContentAnalytics;
  goalId: string;
  later: boolean;
  workflowRunId: string;
};

function getAnswerFormat(
  write: MockQuestionWrites["writes"][number],
  defaultFormat: MockQuestionWrites["quickFormat"],
) {
  const { writer } = write.format;

  if (writer.kind === "shortAnswer") {
    return { entry: null, format: "typed", options: null, select: null } as const;
  }

  if (writer.kind === "item") {
    return writer.answerFormat;
  }

  if ((writer.choice?.kind ?? defaultFormat) === "trueFalse") {
    return { entry: null, format: "trueFalse", options: null, select: null } as const;
  }

  return {
    entry: null,
    format: "multipleChoice",
    options: writer.choice?.options ?? null,
    select: 1,
  } as const;
}

const QUESTIONS_PER_BATCH = 10;

/* oxlint-disable no-await-in-loop -- Each skill batch compares against the preceding batch saved to the bank. */
async function writeSkillBatches({
  analytics,
  goalId,
  later,
  quickFormat,
  skillId,
  workflowRunId,
  writes,
}: MockQuestionWrites & WriteContext & { skillId: string }) {
  let written = 0;

  const targets = writes.flatMap((write) => {
    const answerFormat = getAnswerFormat(write, quickFormat);
    return write.skillIds.includes(skillId) ? [{ answerFormat, write }] : [];
  });

  for (const { answerFormat, write } of targets) {
    for (let remaining = write.questionsPerSkill; remaining > 0; remaining -= QUESTIONS_PER_BATCH) {
      const [skill] = await loadMockWritingSkillsStep({ goalId, skillIds: [skillId] });

      if (!skill) {
        return written;
      }

      written += await prepareSkillExamFormatItems({
        analytics,
        count: Math.min(remaining, QUESTIONS_PER_BATCH),
        mock: skill,
        pick: { answerFormat, skill, style: write.format.style },
        wait: later ? "later" : "learner",
        workflowRunId,
      });
    }
  }

  return written;
}

/* oxlint-enable no-await-in-loop */

export async function writeMockQuestions(
  input: MockQuestionWrites & WriteContext,
): Promise<PlacementItemsWritten> {
  const skills = new Set(input.writes.flatMap((write) => write.skillIds));

  const results = await Promise.allSettled(
    [...skills].map((skillId) => writeSkillBatches({ ...input, skillId })),
  );

  await Promise.all(
    results.flatMap((result) =>
      result.status === "rejected"
        ? [
            reportMockSupplyFailureStep({
              error: result.reason,
              workflowRunId: input.workflowRunId,
            }),
          ]
        : [],
    ),
  );

  return countItemWrites(results);
}

export async function prepareMockRecordings({
  goalId,
  recordings,
  later,
  workflowRunId,
}: {
  goalId: string;
  recordings: NonNullable<MockQuestionWrites["recordings"]>;
  later: boolean;
  workflowRunId: string;
}) {
  const wait = later ? "later" : "learner";

  /* oxlint-disable no-await-in-loop -- The next part can reuse an unvoiced set until this part voices it. */
  for (const part of recordings.parts) {
    const setId = await preparePartSet({
      exam: recordings.exam,
      mockGoalId: goalId,
      part,
      wait,
      workflowRunId,
    });

    if (setId) {
      await voiceListeningRecording({ setId, wait, workflowRunId });
    }
  }
  /* oxlint-enable no-await-in-loop */
}
