import {
  type OwedSentenceOrdersStatus,
  writeOwedSentenceOrders,
} from "@zoonk/core/library/language/write-owed-sentence-orders";

export async function writeOwedSentenceOrdersStep(
  lessonId: string,
): Promise<OwedSentenceOrdersStatus> {
  "use step";

  return writeOwedSentenceOrders({ lessonId });
}
