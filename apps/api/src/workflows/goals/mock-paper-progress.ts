import {
  MOCK_PAPER_READY_STEP,
  type MockPaperStepName,
} from "@zoonk/core/library/generation/steps";
import { WORKFLOW_ERROR_STEP } from "@zoonk/core/workflows/steps";
import { claimRunToken } from "../_shared/run-token";
import { progressStep } from "../_shared/stream-status";

type PaperStep = Exclude<MockPaperStepName, "mockPaperReady">;

export function getMockPaperToken({ goalId, paper }: { goalId: string; paper: string }): string {
  return `mock-paper:${goalId}:${paper}`;
}

export async function openMockPaperProgress({ goalId, paper }: { goalId: string; paper: string }) {
  const namespace = getMockPaperToken({ goalId, paper });
  const writer = await claimRunToken(namespace);
  const progress = progressStep<MockPaperStepName | typeof WORKFLOW_ERROR_STEP>;
  let ended = writer.conflict !== null;

  return {
    async end(outcome: "short" | "written"): Promise<void> {
      if (ended) {
        return;
      }

      await progress(
        outcome === "written"
          ? { status: "completed", step: MOCK_PAPER_READY_STEP }
          : { reason: "aiGenerationFailed", status: "error", step: WORKFLOW_ERROR_STEP },
        { last: true, namespace },
      );

      ended = true;
    },

    async step<T>(step: PaperStep, work: () => Promise<T>): Promise<T> {
      if (ended) {
        return work();
      }

      await progress({ status: "started", step }, { namespace });
      const result = await work();
      await progress({ status: "completed", step }, { namespace });

      return result;
    },
  };
}
