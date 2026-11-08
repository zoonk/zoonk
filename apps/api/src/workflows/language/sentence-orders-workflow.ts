import { type CallWait } from "@zoonk/ai/provider-options";
import { type OwedSentenceOrdersStatus } from "@zoonk/core/library/language/write-owed-sentence-orders";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { generateSentenceOrdersStep, writeSentenceOrdersStep } from "./steps/sentence-orders-steps";

type SentenceOrdersInput = { analytics?: ContentAnalytics; lessonId: string; wait: CallWait };

export function getSentenceOrdersToken(lessonId: string): string {
  return `sentence-orders:${lessonId}`;
}

/** Writes a lesson's owed word orders, holding its token through `startOnce`. */
export async function sentenceOrdersWorkflow({
  analytics,
  lessonId,
  wait,
}: SentenceOrdersInput): Promise<OwedSentenceOrdersStatus> {
  "use workflow";

  const generated = await generateSentenceOrdersStep({ analytics, lessonId, wait });

  if (generated.status !== "generated") {
    return generated.status;
  }

  return writeSentenceOrdersStep({ analytics, candidates: generated.candidates, lessonId, wait });
}
