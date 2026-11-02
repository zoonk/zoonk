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
  /** A run writing the same key is joined. */
  key: string;
  later: boolean;
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
