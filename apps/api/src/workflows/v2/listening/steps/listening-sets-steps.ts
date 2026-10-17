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
  /** `learner` while a learner waits on the recording; `later` for the goal's setup. */
  wait: CallWait;
  workflowRunId: string;
};

/** Recordings are shared by every learner of the exam: an exam's content is very likely reused. */
function getServiceTier(wait: CallWait) {
  return chooseServiceTier({ reuse: "bounded", wait });
}

function toAnalytics({ analytics, workflowRunId }: Omit<PartStepInput, "exam" | "part" | "wait">) {
  return toContentAnalytics({ analytics, scope: { ownerId: null }, workflowRunId });
}

/** The parts of the goal's exam to make a recording ready for (`listListeningPartsToPrepare`). */
export async function listListeningPartsToPrepareStep(input: {
  goalId: string;
  userId?: string;
}): Promise<PartsToPrepare | null> {
  "use step";

  return listListeningPartsToPrepare(input);
}

/**
 * A set of the part ready to voice: one whose voicing failed before, or a new one written now
 * (none once the part has its most sets). A failed write fails the step, which the runtime
 * retries once.
 */
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

/** Voices the set's recording (or gives it the file of a twin script); false when it failed. */
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
