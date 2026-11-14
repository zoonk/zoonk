import { getAppLocale } from "@/i18n/locale";
import { type ScorePatternsData } from "@zoonk/core/progress/get-score-patterns";
import { getExtracted } from "next-intl/server";
import { getScoreWeekdayLabel } from "./_utils/weekday";
import { getTimePeriodNames } from "./pattern-names";

export async function getBestDayName(
  verdict: ScorePatternsData["dayVerdict"],
): Promise<string | null> {
  const t = await getExtracted();
  const locale = await getAppLocale();

  if (verdict.kind === "even") {
    return t("Any day");
  }

  return verdict.kind === "best"
    ? getScoreWeekdayLabel({ dayOfWeek: verdict.best.dayOfWeek, locale })
    : null;
}

export async function getBestTimeName(
  verdict: ScorePatternsData["timeVerdict"],
): Promise<string | null> {
  const t = await getExtracted();
  const names = await getTimePeriodNames();

  if (verdict.kind === "even") {
    return t("Any time");
  }

  return verdict.kind === "best" ? (names.at(verdict.best.period) ?? null) : null;
}
