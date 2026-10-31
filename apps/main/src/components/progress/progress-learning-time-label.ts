import { getAppLocale } from "@/i18n/locale";
import { formatDuration } from "@zoonk/utils/duration";

export async function getProgressLearningTimeLabel({
  totalSeconds,
}: {
  totalSeconds: number;
}): Promise<string> {
  const locale = await getAppLocale();
  return formatDuration({ locale, totalSeconds });
}
