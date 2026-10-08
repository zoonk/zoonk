import { MOCK_QUESTIONS_READY_STEP } from "@zoonk/core/library/generation/steps";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { createHook, getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { preparePlacementItemsStep } from "./steps/goal-lookahead-steps";
import { mockQuestionsProgressStep } from "./steps/mock-questions-progress-step";

export type MockQuestionsInput = {
  analytics?: ContentAnalytics;
  /** The exam's quick format, the one the mock asks in. */
  format: "multipleChoice" | "trueFalse";
  goalId: string;
  /** How many questions the learner hasn't answered each skill needs: its share of the mock. */
  questionsPerSkill: number;
  /** The mock's skills short of their share. */
  skillIds: string[];
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
 * the exam's own format for every skill the mock asks about short of its share of questions the
 * learner hasn't answered, all at once. They join the shared item bank, so every later learner of
 * the exam (and placement, reviews and practice) asks them without writing them again. One run per
 * goal: a second start joins it. It fails only when no question could be written; the mock starts
 * with what exists.
 */
export async function mockQuestionsWorkflow(
  input: MockQuestionsInput,
): Promise<MockQuestionsResult> {
  "use workflow";

  const { analytics, format, goalId, questionsPerSkill, skillIds } = input;
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
    const { failed, written } = await preparePlacementItemsStep({
      analytics,
      exceptAnswered: true,
      formats: [format],
      goalId,
      quickCount: questionsPerSkill,
      quickNeeded: questionsPerSkill,
      skillIds,
      workflowRunId,
    });

    if (written === 0 && failed > 0) {
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
