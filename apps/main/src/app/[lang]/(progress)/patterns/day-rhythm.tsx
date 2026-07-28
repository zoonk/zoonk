import { type TimeScorePattern } from "@zoonk/core/progress/get-score-patterns";
import { formatMetricPercent } from "@zoonk/utils/number";
import { type LucideIcon, Moon, MoonStar, Sun, Sunrise } from "lucide-react";
import { getExtracted, getFormatter, getLocale } from "next-intl/server";
import { getScoreTimePeriodRange } from "./_utils/time-period";
import {
  PatternSection,
  PatternSectionDescription,
  PatternSectionHeader,
  PatternSectionTitle,
} from "./pattern-section";

const DAY_RHYTHM_TITLE_ID = "day-rhythm-title";
const TIME_PERIOD_ICONS = [Moon, Sunrise, Sun, MoonStar] as const;

/** Keeps each fixed daypart paired with a familiar icon from the app's icon set. */
function getTimePeriodIcon(period: number): LucideIcon {
  return TIME_PERIOD_ICONS.at(period) ?? Moon;
}

/**
 * Renders one daypart with its localized clock range and honest sample size.
 * Missing attempts stay visually muted instead of masquerading as a 0% score.
 */
async function DayRhythmItem({
  isStrongest,
  pattern,
}: {
  isStrongest: boolean;
  pattern: TimeScorePattern;
}) {
  const t = await getExtracted();
  const format = await getFormatter();
  const locale = await getLocale();
  const periodNames = [t("Night"), t("Morning"), t("Afternoon"), t("Evening")] as const;
  const period = periodNames.at(pattern.period) ?? periodNames[0];
  const labelId = `day-rhythm-${pattern.period}`;
  const hasAnswers = pattern.totalAnswers > 0;
  const score = formatMetricPercent({ format, value: pattern.score });
  const timeRange = getScoreTimePeriodRange({ locale, period: pattern.period });
  const Icon = getTimePeriodIcon(pattern.period);

  return (
    <article
      aria-labelledby={labelId}
      className="bg-muted/40 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl p-3"
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className={
            isStrongest
              ? "bg-score text-background flex size-9 shrink-0 items-center justify-center rounded-full"
              : "bg-background text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full"
          }
        >
          <Icon className="size-4" />
        </span>

        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium" id={labelId}>
            {period}
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">{timeRange}</p>
        </div>
      </div>

      <div className="flex min-w-20 flex-col items-end">
        <p
          className={
            hasAnswers
              ? "text-score text-sm font-semibold tabular-nums"
              : "text-muted-foreground text-sm font-semibold"
          }
        >
          {hasAnswers ? score : "—"}
        </p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          {hasAnswers
            ? t("{count, plural, one {# answer} other {# answers}}", {
                count: pattern.totalAnswers,
              })
            : t("No answers")}
        </p>
      </div>
    </article>
  );
}

/** Presents the four independent dayparts as one compact daily rhythm. */
export async function DayRhythm({
  patterns,
  strongestPeriod,
}: {
  patterns: TimeScorePattern[];
  strongestPeriod: number | null;
}) {
  const t = await getExtracted();

  return (
    <PatternSection aria-labelledby={DAY_RHYTHM_TITLE_ID}>
      <PatternSectionHeader>
        <PatternSectionTitle id={DAY_RHYTHM_TITLE_ID}>
          {t("Throughout the day")}
        </PatternSectionTitle>
        <PatternSectionDescription>
          {t("Accuracy by time of day over the past 90 days")}
        </PatternSectionDescription>
      </PatternSectionHeader>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {patterns.map((pattern) => (
          <DayRhythmItem
            isStrongest={pattern.period === strongestPeriod}
            key={pattern.period}
            pattern={pattern}
          />
        ))}
      </div>
    </PatternSection>
  );
}
