import { getAppLocale } from "@/i18n/locale";
import { type ScorePatternsData } from "@zoonk/core/progress/get-score-patterns";
import { getExtracted } from "next-intl/server";
import { getScoreWeekdayLabel } from "./_utils/weekday";
import { getTimePeriodNames } from "./pattern-names";

/** With enough answers and no day ahead, it says so in the Patterns page's words. */
export async function getBestDayName(
  verdict: ScorePatternsData["dayVerdict"],
): Promise<string | null> {
  if (verdict.kind === "even") {
    const t = await getExtracted();
    return t("You answer about the same every day.");
  }

  if (verdict.kind !== "best") {
    return null;
  }

  const locale = await getAppLocale();
  return getScoreWeekdayLabel({ dayOfWeek: verdict.best.dayOfWeek, locale });
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
