import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import {
  type PartsToPrepare,
  findUnvoicedPartSet,
  listListeningPartsToPrepare,
  writePartSet,
} from "@zoonk/core/exams/listening/prepare";
import { safeAsync } from "@zoonk/utils/error";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { storeKeyCheckedItemSet } from "../../_shared/item-set-steps";
import { screenMockSet } from "../../goals/steps/mock-set-overlap";

type PartStepInput = Pick<PartsToPrepare, "exam"> & {
  mockGoalId?: string;
  analytics?: ContentAnalytics;
  part: PartsToPrepare["parts"][number];
  wait: CallWait;
  workflowRunId: string;
};

function toAnalytics({ analytics, workflowRunId }: Omit<PartStepInput, "exam" | "part" | "wait">) {
  return toContentAnalytics({ analytics, scope: { ownerId: null }, workflowRunId });
}

export async function listListeningPartsToPrepareStep(input: {
  goalId: string;
  userId?: string;
}): Promise<PartsToPrepare | null> {
  "use step";

  return listListeningPartsToPrepare(input);
}

async function findUnvoicedPartSetStep(input: PartStepInput): Promise<string | null> {
  "use step";

  return findUnvoicedPartSet({ ...input, mockOnly: Boolean(input.mockGoalId) });
}

async function writePartSetStep(input: PartStepInput) {
  "use step";

  return writePartSet({
    analytics: toAnalytics(input),
    exam: input.exam,
    mockOnly: Boolean(input.mockGoalId),
    part: input.part,
    serviceTier: chooseServiceTier({ wait: input.wait }),
  });
}

export async function preparePartSet(input: PartStepInput): Promise<string | null> {
  const unvoiced = await findUnvoicedPartSetStep(input);

  if (unvoiced) {
    return unvoiced;
  }

  const first = await writePartSetStep(input);
  const second = first === "flawed" ? await safeAsync(() => writePartSetStep(input)) : null;
  const written = second ? second.data : first;
  const valid = written === "flawed" ? null : written;

  const set =
    input.mockGoalId && valid
      ? await screenMockSet({
          goalId: input.mockGoalId,
          set: valid,
          wait: input.wait,
          workflowRunId: input.workflowRunId,
        })
      : valid;

  return storeKeyCheckedItemSet({ analytics: toAnalytics(input), set, wait: input.wait });
}
