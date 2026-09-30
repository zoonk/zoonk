import { TEST_OUT_QUESTIONS_READY_STEP } from "@zoonk/core/library/generation/steps";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { createHook, getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { preparePlacementItemsStep } from "./steps/goal-lookahead-steps";
import { testOutQuestionsProgressStep } from "./steps/test-out-questions-progress-step";

export type TestOutQuestionsInput = {
  analytics?: ContentAnalytics;
  chapterId: string;
  goalId: string;
  /** The skills the test-out samples that have no question yet. */
  skillIds: string[];
};

export type TestOutQuestionsResult = { status: "failed" | "joined" | "written" };

const TEST_OUT_FORMATS = ["multipleChoice"] as const;

/** A test-out asks one question per skill; a few give a retake questions the learner hasn't seen. */
const TEST_OUT_QUESTIONS_PER_SKILL = 3;

async function reportFailure(): Promise<void> {
  await testOutQuestionsProgressStep({
    reason: "aiGenerationFailed",
    status: "error",
    step: WORKFLOW_ERROR_STEP,
  });
}

/**
 * Writes the questions a chapter's test-out still needs, when the learner asks for its test: a few
 * multiple-choice questions for every skill it samples that has none, all at once at the priority
 * tier (they join the shared item bank, so placement, reviews and practice use them too). One run
 * per goal's chapter: a second start joins it. It fails only when no question could be written;
 * the test-out asks what exists.
 */
export async function testOutQuestionsWorkflow(
  input: TestOutQuestionsInput,
): Promise<TestOutQuestionsResult> {
  "use workflow";

  const { analytics, chapterId, goalId, skillIds } = input;
  const { workflowRunId } = getWorkflowMetadata();
  const hook = createHook({ token: `test-out-questions:${goalId}:${chapterId}` });
  const conflict = await hook.getConflict();

  if (conflict) {
    await testOutQuestionsProgressStep({
      entityId: conflict.runId,
      status: "started",
      step: "joinTestOutQuestions",
    });

    return { status: "joined" };
  }

  await testOutQuestionsProgressStep({ status: "started", step: "writeTestOutQuestions" });

  try {
    const { failed, written } = await preparePlacementItemsStep({
      analytics,
      formats: TEST_OUT_FORMATS,
      goalId,
      quickCount: TEST_OUT_QUESTIONS_PER_SKILL,
      skillIds,
      workflowRunId,
    });

    if (written === 0 && failed > 0) {
      await reportFailure();
      return { status: "failed" };
    }

    await testOutQuestionsProgressStep({
      status: "completed",
      step: TEST_OUT_QUESTIONS_READY_STEP,
    });

    return { status: "written" };
  } catch (error) {
    await reportFailure();
    throw error;
  }
}
