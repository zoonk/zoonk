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
  format: "multipleChoice" | "trueFalse";
  goalId: string;
  questionsPerSkill: number;
  skillIds: string[];
};

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
