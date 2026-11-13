import { getAppLocale } from "@/i18n/locale";
import { type ScorePatternsData } from "@zoonk/core/progress/get-score-patterns";
import { getExtracted } from "next-intl/server";
import { getScoreTimePeriodRange } from "./_utils/time-period";
import { getScoreWeekdayLabel, getScoreWeekdayShortLabel } from "./_utils/weekday";
import { PatternChart } from "./pattern-chart";
import { getTimePeriodNames } from "./pattern-names";
import { TimePeriodIcon } from "./time-period-icon";

/** Core counts periods from midnight; a learner's day runs from the morning to the night after it. */
const DAY_ORDER = [1, 2, 3, 0] as const;

export async function WeekPatterns({
  patterns,
  verdict,
}: {
  patterns: ScorePatternsData["weekdays"];
  verdict: ScorePatternsData["dayVerdict"];
}) {
  const [t, locale] = await Promise.all([getExtracted(), getAppLocale()]);

  const best = verdict.kind === "best" ? verdict.best : null;

  const columns = patterns.map((pattern) => ({
    best: pattern.dayOfWeek === best?.dayOfWeek,
    id: `week-patterns-${pattern.dayOfWeek}`,
    name: getScoreWeekdayLabel({ dayOfWeek: pattern.dayOfWeek, locale }),
    pattern,
    shortName: getScoreWeekdayShortLabel({ dayOfWeek: pattern.dayOfWeek, locale }),
  }));

  return (
    <PatternChart
      bestLabel={t("Best day")}
      columns={columns}
      id="week-patterns"
      title={t("Throughout the week")}
    />
  );
}

export async function DayPatterns({
  patterns,
  verdict,
}: {
  patterns: ScorePatternsData["times"];
  verdict: ScorePatternsData["timeVerdict"];
}) {
  const [t, locale, names] = await Promise.all([
    getExtracted(),
    getAppLocale(),
    getTimePeriodNames(),
  ]);

  const best = verdict.kind === "best" ? verdict.best : null;

  const columns = DAY_ORDER.map((period) => patterns.find((pattern) => pattern.period === period))
    .filter((pattern) => pattern !== undefined)
    .map((pattern) => ({
      best: pattern.period === best?.period,
      caption: getScoreTimePeriodRange({ locale, period: pattern.period }),
      icon: <TimePeriodIcon period={pattern.period} />,
      id: `day-patterns-${pattern.period}`,
      name: names.at(pattern.period) ?? "",
      pattern,
    }));

  return (
    <PatternChart
      bestLabel={t("Best time")}
      columns={columns}
      id="day-patterns"
      title={t("Throughout the day")}
    />
  );
}
