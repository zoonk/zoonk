import { type CallWait, chooseServiceTier } from "@zoonk/ai/provider-options";
import {
  type OwedSentenceOrdersStatus,
  type SentenceOrderCandidates,
  type SentenceOrderCandidatesResult,
  generateSentenceOrderCandidates,
  writeCheckedSentenceOrders,
} from "@zoonk/core/library/language/write-owed-sentence-orders";
import { type ContentAnalytics } from "../../_shared/content-analytics";

type OrdersStepInput = { analytics?: ContentAnalytics; lessonId: string; wait: CallWait };

export async function generateSentenceOrdersStep({
  analytics,
  lessonId,
  wait,
}: OrdersStepInput): Promise<SentenceOrderCandidatesResult> {
  "use step";

  return generateSentenceOrderCandidates({
    analytics,
    lessonId,
    serviceTier: chooseServiceTier({ wait }),
  });
}

export async function writeSentenceOrdersStep({
  analytics,
  candidates,
  lessonId,
  wait,
}: OrdersStepInput & { candidates: SentenceOrderCandidates }): Promise<OwedSentenceOrdersStatus> {
  "use step";

  return writeCheckedSentenceOrders({
    analytics,
    candidates,
    lessonId,
    serviceTier: chooseServiceTier({ wait }),
  });
}
