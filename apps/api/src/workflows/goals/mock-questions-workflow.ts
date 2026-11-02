import { type MockQuestionWrites } from "@zoonk/core/exams/mocks/prep";
import {
  MOCK_QUESTIONS_READY_STEP,
  type MockQuestionsStepName,
} from "@zoonk/core/library/generation/steps";
import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { prepareMockRecordings, writeMockQuestions } from "./mock-question-writes";
import { type QuestionWritingResult, runQuestionWriting } from "./question-writing-run";

export type MockQuestionsInput = MockQuestionWrites & {
  analytics?: ContentAnalytics;
  goalId: string;
  listening?: boolean;
};

export async function mockQuestionsWorkflow(
  input: MockQuestionsInput,
): Promise<QuestionWritingResult> {
  "use workflow";

  const { analytics, goalId, listening = false, quickFormat, writes } = input;
  const { workflowRunId } = getWorkflowMetadata();

  return runQuestionWriting<MockQuestionsStepName>({
    steps: {
      join: "joinMockQuestions",
      ready: MOCK_QUESTIONS_READY_STEP,
      write: "writeMockQuestions",
    },
    token: `mock-questions:${goalId}`,
    write: async () => {
      const [{ failed, written }, voiced] = await Promise.all([
        writeMockQuestions({ analytics, goalId, later: false, quickFormat, workflowRunId, writes }),
        listening ? prepareMockRecordings({ analytics, goalId, workflowRunId }) : 0,
      ]);

      return written === 0 && voiced === 0 && (failed > 0 || listening) ? "failed" : "written";
    },
  });
}
