import { type OwedSentenceOrdersStatus } from "@zoonk/core/library/language/write-owed-sentence-orders";
import { claimRunToken } from "../_shared/run-token";
import { writeOwedSentenceOrdersStep } from "./steps/sentence-orders-steps";

type SentenceOrdersResult = Record<OwedSentenceOrdersStatus, number>;

/** One run writes a lesson's orders at a time, so two never pay for the same lesson. */
async function writeLessonOrders(lessonId: string): Promise<OwedSentenceOrdersStatus> {
  using claim = await claimRunToken(`sentence-orders:${lessonId}`);
  return claim.conflict ? "skipped" : await writeOwedSentenceOrdersStep(lessonId);
}

/** Temporary: writes the other word orders that lessons written before them still owe. */
export async function sentenceOrdersWorkflow({
  lessonIds,
}: {
  lessonIds: string[];
}): Promise<SentenceOrdersResult> {
  "use workflow";

  const runs = await Promise.allSettled(lessonIds.map((lessonId) => writeLessonOrders(lessonId)));
  const statuses = runs.flatMap((run) => (run.status === "fulfilled" ? [run.value] : []));
  const countOf = (status: OwedSentenceOrdersStatus) => statuses.filter((item) => item === status).length;

  return { changed: countOf("changed"), skipped: countOf("skipped"), written: countOf("written") };
}
