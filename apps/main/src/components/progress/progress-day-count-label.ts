import { getExtracted } from "next-intl/server";

/**
 * Insight cards use day counts in multiple metrics. Keeping this as one ICU
 * plural message lets each locale choose its own grammar instead of branching
 * between English singular and plural strings in application code.
 */
export async function getProgressDayCountLabel({ count }: { count: number }): Promise<string> {
  const t = await getExtracted();

  return t("{count, plural, =0 {# days} one {# day} other {# days}}", { count });
}
