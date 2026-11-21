import {
  MOCK_PAPER_READY_STEP,
  type MockPaperStepName,
} from "@zoonk/core/library/generation/steps";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { progressStep } from "../_shared/stream-status";

type PaperStep = Exclude<MockPaperStepName, "mockPaperReady">;

export function getMockPaperToken({ goalId, paper }: { goalId: string; paper: string }): string {
  return `mock-paper:${goalId}:${paper}`;
}

/**
 * What the learner waiting for `paper` follows: that paper's steps, then whether it's written. The
 * run's other papers report nothing, and the stream ends with the paper, since the learner's wait
 * does.
 */
export function createMockPaperProgress(paper: string | undefined) {
  const progress = progressStep<MockPaperStepName | typeof WORKFLOW_ERROR_STEP>;
  let ended = paper === undefined;

  return {
    async end(outcome: "short" | "written"): Promise<void> {
      if (ended) {
        return;
      }

      ended = true;

      await progress(
        outcome === "written"
          ? { status: "completed", step: MOCK_PAPER_READY_STEP }
          : { reason: "aiGenerationFailed", status: "error", step: WORKFLOW_ERROR_STEP },
        { last: true },
      );
    },

    follows(key: string): boolean {
      return !ended && key === paper;
    },

    /** `key` is the paper `work` writes for: only the followed one reports it. */
    async step<T>(key: string, step: PaperStep, work: () => Promise<T>): Promise<T> {
      if (ended || key !== paper) {
        return work();
      }

      await progress({ status: "started", step });
      const result = await work();
      await progress({ status: "completed", step });

      return result;
    },
  };
}
