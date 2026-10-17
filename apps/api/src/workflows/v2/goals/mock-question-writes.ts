import { type MockQuestionWrites } from "@zoonk/core/exams/mocks/prep";
import { type ContentAnalytics } from "../_shared/content-analytics";
import {
  listListeningPartsToPrepareStep,
  preparePartSetStep,
  voiceListeningSetStep,
} from "../listening/steps/listening-sets-steps";
import { type PlacementItemsWritten, preparePlacementItems } from "./placement-items";
import { prepareExamFormatItemsStep } from "./steps/exam-format-items-step";
import { loadMockWritingSkillsStep } from "./steps/mock-question-steps";

/** A skill's write counts as written when it stored a question, as failed when its step failed. */
function countItemWrites(results: readonly PromiseSettledResult<number>[]): PlacementItemsWritten {
  return {
    failed: results.filter((result) => result.status === "rejected").length,
    written: results.filter((result) => result.status === "fulfilled" && result.value > 0).length,
  };
}

/** The quick writes' counts, added up. */
function sumWritten(results: readonly PlacementItemsWritten[]): PlacementItemsWritten {
  return results.reduce(
    (total, result) => ({
      failed: total.failed + result.failed,
      written: total.written + result.written,
    }),
    { failed: 0, written: 0 },
  );
}

/**
 * Writes what mocks are short of, every format at once (see `MockQuestionWrites`), only what each
 * skill lacks: the exam's one-pick questions with placement's quick writer, a few skills per
 * call, and each other format (several picks, a number typed in) with the item writer, one call
 * per skill, each a step of its own so one failing never holds up the others. They join the
 * exam's shared bank. A learner waits on a mock starting now; `later` is for questions written
 * ahead, at the flex tier.
 */
export async function writeMockQuestions({
  analytics,
  goalId,
  later,
  quickFormat,
  workflowRunId,
  writes,
}: MockQuestionWrites & {
  analytics?: ContentAnalytics;
  goalId: string;
  later: boolean;
  workflowRunId: string;
}): Promise<PlacementItemsWritten> {
  const quick = writes.filter((write) => write.format.writer.kind === "quick");

  const items = writes.flatMap((write) =>
    write.format.writer.kind === "item"
      ? [{ answerFormat: write.format.writer.answerFormat, write }]
      : [],
  );

  const skillIds = [...new Set(items.flatMap(({ write }) => write.skillIds))];
  const skills = skillIds.length > 0 ? await loadMockWritingSkillsStep({ goalId, skillIds }) : [];

  const [quickWritten, itemResults] = await Promise.all([
    Promise.all(
      quick.map((write) =>
        preparePlacementItems({
          analytics,
          exceptAnswered: true,
          formats: [quickFormat],
          goalId,
          later,
          quickCount: write.questionsPerSkill,
          quickNeeded: write.target,
          skillIds: write.skillIds,
          workflowRunId,
        }),
      ),
    ).then(sumWritten),
    Promise.allSettled(
      items.flatMap(({ answerFormat, write }) =>
        skills
          .filter((skill) => write.skillIds.includes(skill.id))
          .map((skill) =>
            prepareExamFormatItemsStep({
              analytics,
              count: write.questionsPerSkill,
              pick: { answerFormat, skill },
              wait: later ? "later" : "learner",
              workflowRunId,
            }),
          ),
      ),
    ),
  ]);

  const itemsWritten = countItemWrites(itemResults);

  return {
    failed: quickWritten.failed + itemsWritten.failed,
    written: quickWritten.written + itemsWritten.written,
  };
}

/**
 * Writes and voices a recording for each listening part of the goal's exam that has none
 * (`listListeningPartsToPrepare`), every part at once, while the learner waits on the mock. They
 * join the exam's shared recordings. Returns how many were voiced.
 */
export async function prepareMockRecordings({
  analytics,
  goalId,
  workflowRunId,
}: {
  analytics?: ContentAnalytics;
  goalId: string;
  workflowRunId: string;
}): Promise<number> {
  const unready = await listListeningPartsToPrepareStep({ goalId });

  if (!unready) {
    return 0;
  }

  const context = { analytics, wait: "learner" as const, workflowRunId };

  const voiced = await Promise.allSettled(
    unready.parts.map(async (part) => {
      const setId = await preparePartSetStep({ ...context, exam: unready.exam, part });
      return setId ? voiceListeningSetStep({ ...context, setId }) : false;
    }),
  );

  return voiced.filter((result) => result.status === "fulfilled" && result.value).length;
}
