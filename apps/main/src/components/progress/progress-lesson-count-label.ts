import { getExtracted } from "next-intl/server";

/**
 * Lesson totals appear on both summary cards and the Activity page. Keeping
 * the count in one ICU plural message lets each locale choose the correct
 * grammar without duplicating English singular and plural branches.
 */
export async function getProgressLessonCountLabel({ count }: { count: number }): Promise<string> {
  const t = await getExtracted();

  return t("{count, plural, =0 {# lessons} one {# lesson} other {# lessons}}", { count });
}
