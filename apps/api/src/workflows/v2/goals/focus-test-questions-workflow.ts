import {
  FOCUS_TEST_QUESTIONS_READY_STEP,
  type FocusTestQuestionsStepName,
} from "@zoonk/core/library/generation/steps";
import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { preparePlacementItems } from "./placement-items";
import { type QuestionWritingResult, runQuestionWriting } from "./question-writing-run";

export type FocusTestQuestionsInput = {
  analytics?: ContentAnalytics;
  /** The exam's quick format, the one the test asks in. */
  format: "multipleChoice" | "trueFalse";
  goalId: string;
  /** How many questions each of them needs: more for an area of few skills. */
  questionsPerSkill: number;
  /** The skills the test asks about that lack their questions. */
  skillIds: string[];
};

/**
 * Writes the questions a goal's focus test still needs, when the learner starts it, while the test
 * asks the ones that exist: questions in the exam's quick format for every skill it asks about
 * short of its share of questions the learner hasn't answered, all at once (they join the shared
 * item bank, so placement, reviews and practice use them too). One run per goal: a second start
 * joins it. It fails only when no question could be written.
 */
export async function focusTestQuestionsWorkflow(
  input: FocusTestQuestionsInput,
): Promise<QuestionWritingResult> {
  "use workflow";

  const { analytics, format, goalId, questionsPerSkill, skillIds } = input;
  const { workflowRunId } = getWorkflowMetadata();

  return runQuestionWriting<FocusTestQuestionsStepName>({
    steps: {
      join: "joinFocusTestQuestions",
      ready: FOCUS_TEST_QUESTIONS_READY_STEP,
      write: "writeFocusTestQuestions",
    },
    token: `focus-test-questions:${goalId}`,
    write: async () => {
      const { failed, written } = await preparePlacementItems({
        analytics,
        exceptAnswered: true,
        formats: [format],
        goalId,
        quickCount: questionsPerSkill,
        quickNeeded: questionsPerSkill,
        skillIds,
        workflowRunId,
      });

      return written === 0 && failed > 0 ? "failed" : "written";
    },
  });
}
