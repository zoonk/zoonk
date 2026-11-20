import { getAppLocale } from "@/i18n/locale";
import { type ScorePatternsData } from "@zoonk/core/progress/get-score-patterns";
import { getExtracted } from "next-intl/server";
import { getScoreWeekdayLabel } from "./_utils/weekday";
import { getTimePeriodNames } from "./pattern-names";

/** With enough answers and no day ahead, any day is the best one, as "Any time" says of the time. */
export async function getBestDayName(
  verdict: ScorePatternsData["dayVerdict"],
): Promise<string | null> {
  if (verdict.kind === "even") {
    const t = await getExtracted();

    return t({
      description: "Best day when every day of the week scores about the same",
      message: "Any day",
    });
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
