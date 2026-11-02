import { getExtracted } from "next-intl/server";

export async function getProgressDayCountLabel({ count }: { count: number }): Promise<string> {
  const t = await getExtracted();

  return t("{count, plural, =0 {# days} one {# day} other {# days}}", { count });
}
