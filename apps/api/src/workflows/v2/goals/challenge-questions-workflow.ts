import { type ChallengeQuestionWrite } from "@zoonk/core/checkpoints/rules";
import { CHALLENGE_QUESTIONS_READY_STEP } from "@zoonk/core/library/generation/steps";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { claimRunToken } from "../_shared/run-token";
import { type PlacementItemsWritten, preparePlacementItems } from "./placement-items";
import { challengeQuestionsProgressStep } from "./steps/challenge-questions-progress-step";

export type ChallengeQuestionsInput = {
  analytics?: ContentAnalytics;
  goalId: string;
  /** Names the skills written on (`ChallengeQuestionsWrite`): a run writing them is joined. */
  key: string;
  /** Nobody opens the challenge today: its questions are written at the background tier. */
  later: boolean;
  /** The goal's quick format, the one its challenges ask most. */
  quickFormat: "multipleChoice" | "trueFalse";
  writes: ChallengeQuestionWrite[];
};

export type ChallengeQuestionsResult = { status: "failed" | "joined" | "written" };

async function reportFailure(): Promise<void> {
  await challengeQuestionsProgressStep({
    reason: "aiGenerationFailed",
    status: "error",
    step: WORKFLOW_ERROR_STEP,
  });
}

function sumWritten(results: readonly PlacementItemsWritten[]): PlacementItemsWritten {
  return results.reduce(
    (total, result) => ({
      failed: total.failed + result.failed,
      written: total.written + result.written,
    }),
    { failed: 0, written: 0 },
  );
}

/**
 * Writes what a challenge lacks of its ten questions (`planChallengeWrites`), each write with
 * placement's quick writer in the goal's quick format, all at once. A skill that holds its
 * `target` by the time its write starts is skipped, so nothing past the challenge's size is
 * written. They join the shared item bank, so every learner of those skills (and their reviews
 * and practice) asks them without writing them again. One run per set of skills: a second start,
 * the learner's tap while the session's preparation writes them or another learner reaching the
 * same phase, joins it. It fails only when no question could be written.
 */
export async function challengeQuestionsWorkflow(
  input: ChallengeQuestionsInput,
): Promise<ChallengeQuestionsResult> {
  "use workflow";

  const { analytics, goalId, later, quickFormat, writes } = input;
  const { workflowRunId } = getWorkflowMetadata();
  using claim = await claimRunToken(`challenge-questions:${input.key}`);

  if (claim.conflict) {
    await challengeQuestionsProgressStep({
      entityId: claim.conflict.runId,
      status: "started",
      step: "joinChallengeQuestions",
    });

    return { status: "joined" };
  }

  await challengeQuestionsProgressStep({ status: "started", step: "writeChallengeQuestions" });

  try {
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

    if (written === 0 && failed > 0) {
      await reportFailure();
      return { status: "failed" };
    }

    await challengeQuestionsProgressStep({
      status: "completed",
      step: CHALLENGE_QUESTIONS_READY_STEP,
    });

    return { status: "written" };
  } catch (error) {
    await reportFailure();
    throw error;
  }
}
