import { formatDuration } from "@zoonk/utils/duration";
import { getLocale } from "next-intl/server";

/** Progress cards share the compact duration used by learning screens. */
export async function getProgressLearningTimeLabel({
  totalSeconds,
}: {
  totalSeconds: number;
}): Promise<string> {
  const locale = await getLocale();
  return formatDuration({ locale, totalSeconds });
}
