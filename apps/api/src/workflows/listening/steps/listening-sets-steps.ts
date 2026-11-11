import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import {
  type PartsToPrepare,
  findUnvoicedPartSet,
  listListeningPartsToPrepare,
  writePartSet,
} from "@zoonk/core/exams/listening/prepare";
import { voiceListeningSet } from "@zoonk/core/library/listening/voice";
import { type ContentAnalytics, toContentAnalytics } from "../../_shared/content-analytics";
import { storeKeyCheckedItemSet } from "../../_shared/item-set-steps";

type PartStepInput = Pick<PartsToPrepare, "exam"> & {
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

  return findUnvoicedPartSet(input);
}

async function writePartSetStep(input: PartStepInput) {
  "use step";

  return writePartSet({
    analytics: toAnalytics(input),
    exam: input.exam,
    part: input.part,
    serviceTier: chooseServiceTier({ wait: input.wait }),
  });
}

export async function preparePartSet(input: PartStepInput): Promise<string | null> {
  const unvoiced = await findUnvoicedPartSetStep(input);

  if (unvoiced) {
    return unvoiced;
  }

  return storeKeyCheckedItemSet({
    analytics: toAnalytics(input),
    set: await writePartSetStep(input),
    wait: input.wait,
  });
}

export async function voiceListeningSetStep({
  setId,
  ...input
}: Omit<PartStepInput, "exam" | "part"> & { setId: string }): Promise<boolean> {
  "use step";

  const recording = await voiceListeningSet({
    analytics: toAnalytics(input),
    serviceTier: chooseServiceTier({ wait: input.wait }),
    setId,
  });

  return recording !== null;
}
