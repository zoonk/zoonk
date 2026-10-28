import {
  type TimeScorePattern,
  type WeekdayScorePattern,
} from "@zoonk/core/progress/get-score-patterns";
import { MIN_PATTERN_ANSWERS, type ScorePerformance } from "@zoonk/core/progress/score-performance";
import { LIST_GROUP_CLASS } from "@zoonk/learn/list";
import { PageSection, PageSectionHeader, PageSectionTitle } from "@zoonk/learn/page";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted, getFormatter, getLocale } from "next-intl/server";
import { getScoreTimePeriodRange } from "./_utils/time-period";
import { getScoreWeekdayLabel } from "./_utils/weekday";
import { getTimePeriodNames } from "./pattern-names";

const PERCENT = 100;

type PatternRowView = {
  best: boolean;
  hours?: string;
  id: string;
  meta: string;
  name: string;
  pattern: ScorePerformance;
};

/** Keeps a malformed stored share inside the bar while the number still says what was stored. */
function getBarWidth(score: number): string {
  return `${Math.min(PERCENT, Math.max(0, score))}%`;
}

/** A group with too few answers to count is gray, so a lucky answer never reads as a result. */
function getBarClass({ best, pattern }: Pick<PatternRowView, "best" | "pattern">): string {
  if (pattern.totalAnswers < MIN_PATTERN_ANSWERS) {
    return "bg-foreground/20";
  }

  return best ? "bg-success" : "bg-success/45";
}

/** One without answers stays muted instead of reading as 0%. */
async function PatternRow({ row }: { row: PatternRowView }) {
  const format = await getFormatter();
  const hasAnswers = row.pattern.totalAnswers > 0;
  const counted = row.pattern.totalAnswers >= MIN_PATTERN_ANSWERS;

  return (
    <li
      aria-labelledby={row.id}
      className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3rem] items-center gap-x-4 py-2.5"
    >
      <span className="flex min-w-0 flex-col gap-px">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span
            className={cn(
              "truncate text-sm leading-snug first-letter:uppercase",
              row.best && "font-medium",
            )}
            id={row.id}
          >
            {row.name}
          </span>
          {row.hours && (
            <span className="text-muted-foreground shrink-0 font-mono text-[0.71875rem] whitespace-nowrap tabular-nums">
              {row.hours}
            </span>
          )}
        </span>
        <span className="text-muted-foreground truncate font-mono text-xs leading-snug tabular-nums">
          {row.meta}
        </span>
      </span>

      <span aria-hidden="true" className="bg-surface-3 flex h-1.5 overflow-hidden rounded-[2px]">
        {hasAnswers && (
          <span
            className={cn("h-full rounded-[2px]", getBarClass(row))}
            style={{ width: getBarWidth(row.pattern.score) }}
          />
        )}
      </span>

      <span
        className={cn(
          "text-right font-mono text-sm tabular-nums",
          !counted && "text-muted-foreground",
        )}
      >
        {hasAnswers
          ? format.number(row.pattern.score / PERCENT, {
              maximumFractionDigits: 0,
              style: "percent",
            })
          : "–"}
      </span>
    </li>
  );
}

function PatternSection({
  id,
  rows,
  title,
}: {
  id: string;
  rows: PatternRowView[];
  title: string;
}) {
  return (
    <PageSection aria-labelledby={id}>
      <PageSectionHeader>
        <PageSectionTitle id={id}>{title}</PageSectionTitle>
      </PageSectionHeader>

      <ul className={LIST_GROUP_CLASS}>
        {rows.map((row) => (
          <PatternRow key={row.id} row={row} />
        ))}
      </ul>
    </PageSection>
  );
}

export async function WeekPatterns({
  best,
  patterns,
}: {
  best: WeekdayScorePattern | null;
  patterns: WeekdayScorePattern[];
}) {
  const t = await getExtracted();
  const locale = await getLocale();

  const rows = patterns.map((pattern) => ({
    best: pattern.dayOfWeek === best?.dayOfWeek,
    id: `week-patterns-${pattern.dayOfWeek}`,
    meta: t("{count, plural, =0 {No answers} one {# answer} other {# answers}}", {
      count: pattern.totalAnswers,
    }),
    name: getScoreWeekdayLabel({ dayOfWeek: pattern.dayOfWeek, locale }),
    pattern,
  }));

  return <PatternSection id="week-patterns" rows={rows} title={t("Throughout the week")} />;
}

export async function DayPatterns({
  best,
  patterns,
}: {
  best: TimeScorePattern | null;
  patterns: TimeScorePattern[];
}) {
  const t = await getExtracted();
  const locale = await getLocale();
  const names = await getTimePeriodNames();

  const rows = patterns.map((pattern) => ({
    best: pattern.period === best?.period,
    hours: getScoreTimePeriodRange({ locale, period: pattern.period }),
    id: `day-patterns-${pattern.period}`,
    meta: t("{count, plural, =0 {No answers} one {# answer} other {# answers}}", {
      count: pattern.totalAnswers,
    }),
    name: names.at(pattern.period) ?? "",
    pattern,
  }));

  return <PatternSection id="day-patterns" rows={rows} title={t("Throughout the day")} />;
}
