import { type ScorePatternsData } from "@zoonk/core/progress/get-score-patterns";
import { MIN_PATTERN_ANSWERS } from "@zoonk/core/progress/score-performance";
import { getExtracted, getLocale } from "next-intl/server";
import { getScoreWeekdayLabel } from "./_utils/weekday";
import { getTimePeriodNames } from "./pattern-names";

export async function getBestDayName(
  verdict: ScorePatternsData["dayVerdict"],
): Promise<string | null> {
  const t = await getExtracted();
  const locale = await getLocale();

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

export async function PatternsNote({ patterns }: { patterns: ScorePatternsData }) {
  const t = await getExtracted();
  const { dayVerdict: days, timeVerdict: times } = patterns;

  const sentences = [
    days.kind === "even" &&
      t(
        "Your days are within {points, plural, =0 {# points} one {# point} other {# points}} of each other, so any day works.",
        { points: days.points },
      ),
    times.kind === "even" &&
      t(
        "Your times of day are within {points, plural, =0 {# points} one {# point} other {# points}} of each other, so any time works.",
        { points: times.points },
      ),
    t(
      "A day or a time of day needs {count, plural, one {# answer} other {# answers}} to count, so one lucky answer never makes a pattern.",
      { count: MIN_PATTERN_ANSWERS },
    ),
  ].filter(Boolean);

  return <p className="text-muted-foreground text-sm text-pretty">{sentences.join(" ")}</p>;
}
