import { FOCUS_TEST_QUESTIONS_READY_STEP } from "@zoonk/core/library/generation/steps";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { createHook, getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { focusTestQuestionsProgressStep } from "./steps/focus-test-questions-progress-step";
import { preparePlacementItemsStep } from "./steps/goal-lookahead-steps";

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

export type FocusTestQuestionsResult = { status: "failed" | "joined" | "written" };

async function reportFailure(): Promise<void> {
  await focusTestQuestionsProgressStep({
    reason: "aiGenerationFailed",
    status: "error",
    step: WORKFLOW_ERROR_STEP,
  });
}

/**
 * Writes the questions a goal's focus test still needs, when the learner starts it, while the test
 * asks the ones that exist: questions in the exam's quick format for every skill it asks about
 * short of its share of questions the learner hasn't answered, all at once (they join the shared
 * item bank, so placement, reviews and practice use them too). One run per goal: a second start
 * joins it. It fails only when no question could be written.
 */
export async function focusTestQuestionsWorkflow(
  input: FocusTestQuestionsInput,
): Promise<FocusTestQuestionsResult> {
  "use workflow";

  const { analytics, format, goalId, questionsPerSkill, skillIds } = input;
  const { workflowRunId } = getWorkflowMetadata();
  const hook = createHook({ token: `focus-test-questions:${goalId}` });
  const conflict = await hook.getConflict();

  if (conflict) {
    await focusTestQuestionsProgressStep({
      entityId: conflict.runId,
      status: "started",
      step: "joinFocusTestQuestions",
    });

    return { status: "joined" };
  }

  await focusTestQuestionsProgressStep({ status: "started", step: "writeFocusTestQuestions" });

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

    await focusTestQuestionsProgressStep({
      status: "completed",
      step: FOCUS_TEST_QUESTIONS_READY_STEP,
    });

    return { status: "written" };
  } catch (error) {
    await reportFailure();
    throw error;
  }
}
