import {
  TEST_OUT_QUESTIONS_READY_STEP,
  type TestOutQuestionsStepName,
} from "@zoonk/core/library/generation/steps";
import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { preparePlacementItems } from "./placement-items";
import { type QuestionWritingResult, runQuestionWriting } from "./question-writing-run";

export type TestOutQuestionsInput = {
  analytics?: ContentAnalytics;
  chapterId: string;
  goalId: string;
  skillIds: string[];
};

const TEST_OUT_FORMATS = ["multipleChoice", "tap"] as const;

export function getTestOutQuestionsToken({
  chapterId,
  goalId,
}: Pick<TestOutQuestionsInput, "chapterId" | "goalId">): string {
  return `test-out-questions:${goalId}:${chapterId}`;
}

export async function testOutQuestionsWorkflow(
  input: TestOutQuestionsInput,
): Promise<QuestionWritingResult> {
  "use workflow";

  const { analytics, goalId, skillIds } = input;
  const { workflowRunId } = getWorkflowMetadata();

  return runQuestionWriting<TestOutQuestionsStepName>({
    steps: { ready: TEST_OUT_QUESTIONS_READY_STEP, write: "writeTestOutQuestions" },
    write: async () => {
      const { failed, written } = await preparePlacementItems({
        analytics,
        exceptAnswered: true,
        formats: TEST_OUT_FORMATS,
        goalId,
        skillIds,
        workflowRunId,
      });

      return written === 0 && failed > 0 ? "failed" : "written";
    },
  });
}
