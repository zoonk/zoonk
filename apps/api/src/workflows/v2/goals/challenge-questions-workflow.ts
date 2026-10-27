import { type ChallengeQuestionWrite } from "@zoonk/core/checkpoints/rules";
import {
  CHALLENGE_QUESTIONS_READY_STEP,
  type ChallengeQuestionsStepName,
} from "@zoonk/core/library/generation/steps";
import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { type PlacementItemsWritten, preparePlacementItems } from "./placement-items";
import { type QuestionWritingResult, runQuestionWriting } from "./question-writing-run";

export type ChallengeQuestionsInput = {
  analytics?: ContentAnalytics;
  goalId: string;
  /** Names the skills written on (`ChallengeQuestionsWrite`): a run writing them is joined. */
  key: string;
  /** Nobody opens the challenge today: its questions are written at the background tier. */
  later: boolean;
  /** The goal's quick format, the one its challenges ask most. */
  quickFormat: "multipleChoice" | "trueFalse";
  writes: ChallengeQuestionWrite[];
};

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
 * Writes what a challenge lacks of its ten questions (`planChallengeWrites`), each write with
 * placement's quick writer in the goal's quick format, all at once. A skill that holds its
 * `target` by the time its write starts is skipped, so nothing past the challenge's size is
 * written. They join the shared item bank, so every learner of those skills (and their reviews
 * and practice) asks them without writing them again. One run per set of skills: a second start,
 * the learner's tap while the session's preparation writes them or another learner reaching the
 * same phase, joins it. It fails only when no question could be written.
 */
export async function challengeQuestionsWorkflow(
  input: ChallengeQuestionsInput,
): Promise<QuestionWritingResult> {
  "use workflow";

  const { analytics, goalId, later, quickFormat, writes } = input;
  const { workflowRunId } = getWorkflowMetadata();

  return runQuestionWriting<ChallengeQuestionsStepName>({
    steps: {
      join: "joinChallengeQuestions",
      ready: CHALLENGE_QUESTIONS_READY_STEP,
      write: "writeChallengeQuestions",
    },
    token: `challenge-questions:${input.key}`,
    write: async () => {
      const results = await Promise.all(
        writes.map((write) =>
          preparePlacementItems({
            analytics,
            formats: [quickFormat],
            goalId,
            later,
            quickCount: write.questionsPerSkill,
            quickNeeded: write.target,
            skillIds: write.skillIds,
            workflowRunId,
          }),
        ),
      );

      const { failed, written } = sumWritten(results);

      return written === 0 && failed > 0 ? "failed" : "written";
    },
  });
}
