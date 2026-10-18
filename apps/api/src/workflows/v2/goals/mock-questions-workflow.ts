import { type MockQuestionWrites } from "@zoonk/core/exams/mocks/prep";
import { MOCK_QUESTIONS_READY_STEP } from "@zoonk/core/library/generation/steps";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { createHook, getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { prepareMockRecordings, writeMockQuestions } from "./mock-question-writes";
import { mockQuestionsProgressStep } from "./steps/mock-questions-progress-step";

/**
 * Each of the exam's formats the mock is short of, for the skills short of their share, and
 * whether its listening sections lack recordings (`listening`).
 */
export type MockQuestionsInput = MockQuestionWrites & {
  analytics?: ContentAnalytics;
  goalId: string;
  listening?: boolean;
};

export type MockQuestionsResult = { status: "failed" | "joined" | "written" };

async function reportFailure(): Promise<void> {
  await mockQuestionsProgressStep({
    reason: "aiGenerationFailed",
    status: "error",
    step: WORKFLOW_ERROR_STEP,
  });
}

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
): Promise<MockQuestionsResult> {
  "use workflow";

  const { analytics, goalId, listening = false, quickFormat, writes } = input;
  const { workflowRunId } = getWorkflowMetadata();
  const hook = createHook({ token: `mock-questions:${goalId}` });
  const conflict = await hook.getConflict();

  if (conflict) {
    await mockQuestionsProgressStep({
      entityId: conflict.runId,
      status: "started",
      step: "joinMockQuestions",
    });

    return { status: "joined" };
  }

  await mockQuestionsProgressStep({ status: "started", step: "writeMockQuestions" });

  try {
    const [{ failed, written }, voiced] = await Promise.all([
      writeMockQuestions({ analytics, goalId, later: false, quickFormat, workflowRunId, writes }),
      listening ? prepareMockRecordings({ analytics, goalId, workflowRunId }) : 0,
    ]);

    if (written === 0 && voiced === 0 && (failed > 0 || listening)) {
      await reportFailure();
      return { status: "failed" };
    }

    await mockQuestionsProgressStep({ status: "completed", step: MOCK_QUESTIONS_READY_STEP });

    return { status: "written" };
  } catch (error) {
    await reportFailure();
    throw error;
  }
}
