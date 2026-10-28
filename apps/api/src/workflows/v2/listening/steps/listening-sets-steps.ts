import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import {
  type PartsToPrepare,
  findUnvoicedPartSet,
  listListeningPartsToPrepare,
  writePartSet,
} from "@zoonk/core/exams/listening/prepare";
import { voiceListeningSet } from "@zoonk/core/library/listening/voice";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";

type PartStepInput = Pick<PartsToPrepare, "exam"> & {
  analytics?: ContentAnalytics;
  part: PartsToPrepare["parts"][number];
  wait: CallWait;
  workflowRunId: string;
};

function getServiceTier(wait: CallWait) {
  return chooseServiceTier({ reuse: "bounded", wait });
}

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

export async function preparePartSetStep(input: PartStepInput): Promise<string | null> {
  "use step";

  const unvoiced = await findUnvoicedPartSet(input);

  if (unvoiced) {
    return unvoiced;
  }

  return writePartSet({
    analytics: toAnalytics(input),
    exam: input.exam,
    part: input.part,
    serviceTier: getServiceTier(input.wait),
  });
}

preparePartSetStep.maxRetries = 1;

export async function voiceListeningSetStep({
  setId,
  ...input
}: Omit<PartStepInput, "exam" | "part"> & { setId: string }): Promise<boolean> {
  "use step";

  const recording = await voiceListeningSet({
    analytics: toAnalytics(input),
    serviceTier: getServiceTier(input.wait),
    setId,
  });

  return recording !== null;
}
