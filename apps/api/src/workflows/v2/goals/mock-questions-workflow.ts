import { type MockQuestionWrites } from "@zoonk/core/exams/mocks/prep";
import {
  MOCK_QUESTIONS_READY_STEP,
  type MockQuestionsStepName,
} from "@zoonk/core/library/generation/steps";
import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { prepareMockRecordings, writeMockQuestions } from "./mock-question-writes";
import { type QuestionWritingResult, runQuestionWriting } from "./question-writing-run";

/**
 * Each of the exam's formats the mock is short of, for the skills short of their share, and
 * whether its listening sections lack recordings (`listening`).
 */
export type MockQuestionsInput = MockQuestionWrites & {
  analytics?: ContentAnalytics;
  goalId: string;
  listening?: boolean;
};

/**
 * Writes the questions a mock taken any time still needs, when the learner starts it: questions in
 * each of the exam's formats it's short of, for every skill the mock asks about short of its share
 * of questions the learner hasn't answered (`writeMockQuestions`), and the recordings its listening
 * sections lack (`prepareMockRecordings`), all at once. They join the shared bank, so every later
 * learner of the exam (and placement, reviews and practice) gets them without writing them again.
 * One run per goal: a second start joins it. It fails only when nothing could be written; the mock
 * starts with what exists.
 */
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
