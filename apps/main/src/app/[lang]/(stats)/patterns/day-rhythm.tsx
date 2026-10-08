import { type TimeScorePattern } from "@zoonk/core/progress/get-score-patterns";
import {
  LIST_GROUP_CLASS,
  ListRow,
  ListRowContent,
  ListRowDescription,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "@zoonk/learn/list";
import { cn } from "@zoonk/ui/lib/utils";
import { formatMetricPercent } from "@zoonk/utils/number";
import { Moon, MoonStar, Sun, Sunrise } from "lucide-react";
import { getExtracted, getFormatter, getLocale } from "next-intl/server";
import { getScoreTimePeriodRange } from "./_utils/time-period";

const TIME_PERIOD_ICONS = [Moon, Sunrise, Sun, MoonStar] as const;

/**
 * One part of the day as a row of the shared list: its clock range, its share of right answers and
 * how many answers it comes from. A part without answers stays muted instead of reading as 0%.
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
  const Icon = TIME_PERIOD_ICONS[pattern.period] ?? Moon;

  return (
    <li aria-labelledby={labelId}>
      <ListRow>
        <ListRowLeading>
          <span
            aria-hidden="true"
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full",
              isStrongest ? "bg-score text-background" : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
          </span>
        </ListRowLeading>

        <ListRowContent>
          <ListRowTitle className="truncate" id={labelId}>
            {period}
          </ListRowTitle>
          <ListRowDescription className="tabular-nums">
            {getScoreTimePeriodRange({ locale, period: pattern.period })}
          </ListRowDescription>
        </ListRowContent>

        <ListRowTrailing className="flex-col items-end gap-0.5">
          <span
            className={cn("font-semibold", hasAnswers ? "text-score" : "text-muted-foreground")}
          >
            {hasAnswers ? formatMetricPercent({ format, value: pattern.score }) : "—"}
          </span>
          <span className="text-xs">
            {hasAnswers
              ? t("{count, plural, one {# answer} other {# answers}}", {
                  count: pattern.totalAnswers,
                })
              : t("No answers")}
          </span>
        </ListRowTrailing>
      </ListRow>
    </li>
  );
}

/**
 * The best parts of the day: night, morning, afternoon and evening, each with its share of right
 * answers, the strongest one marked.
 */
export async function DayRhythm({
  patterns,
  strongestPeriod,
}: {
  patterns: TimeScorePattern[];
  strongestPeriod: number | null;
}) {
  const t = await getExtracted();

  return (
    <section aria-labelledby="day-rhythm-title" className="flex flex-col gap-3">
      <h2 className="px-1 font-semibold tracking-tight" id="day-rhythm-title">
        {t("Throughout the day")}
      </h2>

      <ul className={LIST_GROUP_CLASS}>
        {patterns.map((pattern) => (
          <DayRhythmItem
            isStrongest={pattern.period === strongestPeriod}
            key={pattern.period}
            pattern={pattern}
          />
        ))}
      </ul>
    </section>
  );
}
