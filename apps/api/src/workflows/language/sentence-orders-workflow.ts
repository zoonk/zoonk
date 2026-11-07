import { type CallWait } from "@zoonk/ai/provider-options";
import { type OwedSentenceOrdersStatus } from "@zoonk/core/library/language/write-owed-sentence-orders";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { claimRunToken } from "../_shared/run-token";
import { generateSentenceOrdersStep, writeSentenceOrdersStep } from "./steps/sentence-orders-steps";

type SentenceOrdersResult = Record<OwedSentenceOrdersStatus, number>;

type SentenceOrdersInput = { analytics?: ContentAnalytics; lessonIds: string[]; wait: CallWait };

export function getSentenceOrdersToken(lessonId: string): string {
  return `sentence-orders:${lessonId}`;
}

/** One run writes a lesson's orders at a time, so two never pay for the same lesson. */
async function writeLessonOrders({
  analytics,
  lessonId,
  wait,
}: Omit<SentenceOrdersInput, "lessonIds"> & {
  lessonId: string;
}): Promise<OwedSentenceOrdersStatus> {
  using claim = await claimRunToken(getSentenceOrdersToken(lessonId));

  if (claim.conflict) {
    return "skipped";
  }

  const generated = await generateSentenceOrdersStep({ analytics, lessonId, wait });

  if (generated.status !== "generated") {
    return generated.status;
  }

  return await writeSentenceOrdersStep({
    analytics,
    candidates: generated.candidates,
    lessonId,
    wait,
  });
}

/**
 * Writes the other word orders lessons owe: a new language lesson's right after it's written, and
 * whatever the daily sweep finds still owed.
 */
export async function sentenceOrdersWorkflow({
  analytics,
  lessonIds,
  wait,
}: SentenceOrdersInput): Promise<SentenceOrdersResult> {
  "use workflow";

  const runs = await Promise.allSettled(
    lessonIds.map((lessonId) => writeLessonOrders({ analytics, lessonId, wait })),
  );

  const statuses = runs.flatMap((run) => (run.status === "fulfilled" ? [run.value] : []));

  const countOf = (status: OwedSentenceOrdersStatus) =>
    statuses.filter((item) => item === status).length;

  return { changed: countOf("changed"), skipped: countOf("skipped"), written: countOf("written") };
}
