"use client";

import { type WeekdayScorePattern } from "@zoonk/core/progress/get-score-patterns";
import { formatMetricPercent } from "@zoonk/utils/number";
import { CalendarDays, Crown } from "lucide-react";
import { useExtracted, useFormatter, useLocale } from "next-intl";
import { useState } from "react";
import {
  getScoreWeekdayLabel,
  getScoreWeekdayMessageValue,
  getScoreWeekdayShortLabel,
} from "./_utils/weekday";
import {
  PatternSection,
  PatternSectionDescription,
  PatternSectionHeader,
  PatternSectionTitle,
} from "./pattern-section";

const WEEKLY_RHYTHM_TITLE_ID = "weekly-rhythm-title";

/**
 * Keeps a malformed historical percentage inside the visual track while the
 * visible formatted value continues to report the underlying stored result.
 */
function getPatternHeight(score: number): string {
  return `${Math.min(100, Math.max(0, score))}%`;
}

/**
 * Opens the chart on the strongest observed weekday so the page answers its
 * primary learner question before any interaction.
 */
function getInitialDayOfWeek({
  patterns,
  strongestDayOfWeek,
}: {
  patterns: WeekdayScorePattern[];
  strongestDayOfWeek: number | null;
}): number {
  return strongestDayOfWeek ?? patterns.find((pattern) => pattern.totalAnswers > 0)?.dayOfWeek ?? 0;
}

/**
 * Resolves the selected chart point from the stable seven-day dataset so the
 * visible detail and live-region announcement always describe the same day.
 */
function getSelectedPattern({
  dayOfWeek,
  patterns,
}: {
  dayOfWeek: number;
  patterns: WeekdayScorePattern[];
}): WeekdayScorePattern {
  return (
    patterns.find((pattern) => pattern.dayOfWeek === dayOfWeek) ?? {
      correctAnswers: 0,
      dayOfWeek,
      incorrectAnswers: 0,
      score: 0,
      totalAnswers: 0,
    }
  );
}

/**
 * Renders one focusable weekday as a compact vertical score mark. The button
 * exposes its complete value and denominator even before it is selected.
 */
function WeekdayRhythmItem({
  isSelected,
  isStrongest,
  onSelect,
  pattern,
}: {
  isSelected: boolean;
  isStrongest: boolean;
  onSelect: () => void;
  pattern: WeekdayScorePattern;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const locale = useLocale();
  const day = getScoreWeekdayLabel({ dayOfWeek: pattern.dayOfWeek, locale });
  const shortDay = getScoreWeekdayShortLabel({ dayOfWeek: pattern.dayOfWeek, locale });
  const hasAnswers = pattern.totalAnswers > 0;
  const score = formatMetricPercent({ format, value: pattern.score });

  const accessibleLabel = hasAnswers
    ? t("{day}: {score} across {count, plural, one {# answer} other {# answers}}", {
        count: pattern.totalAnswers,
        day,
        score,
      })
    : t("{day}: No answers", { day });

  return (
    <button
      aria-label={accessibleLabel}
      aria-pressed={isSelected}
      className="group focus-visible:ring-ring hover:bg-muted/50 flex min-w-0 flex-col items-center rounded-lg px-0.5 py-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:px-1"
      onClick={onSelect}
      type="button"
    >
      <span
        aria-hidden="true"
        className="text-score h-5 text-[0.6875rem] leading-5 font-medium tabular-nums sm:text-xs"
      >
        {hasAnswers ? score : "—"}
      </span>

      <span aria-hidden="true" className="relative mt-2 flex h-36 w-full justify-center sm:h-44">
        {isStrongest && (
          <span className="bg-score text-background absolute -top-1 z-10 flex size-6 items-center justify-center rounded-full">
            <Crown className="size-3.5" />
          </span>
        )}

        <span className="bg-score/15 flex h-full w-2.5 items-end overflow-hidden rounded-full">
          {hasAnswers && (
            <span
              className="bg-score block w-full rounded-full transition-[height] duration-300"
              style={{ height: getPatternHeight(pattern.score) }}
            />
          )}
        </span>

        <span className="bg-score ring-background absolute bottom-0 size-2.5 rounded-full ring-2 transition-transform group-aria-pressed:scale-125" />
      </span>

      <span
        aria-hidden="true"
        className="group-aria-pressed:text-score mt-2 max-w-full truncate text-xs font-medium capitalize sm:text-sm"
      >
        {shortDay}
      </span>
    </button>
  );
}

/**
 * Shows the selected weekday's denominator beneath the compact chart so every
 * value remains inspectable without repeating eleven dense metadata rows.
 */
function WeekdayRhythmStatus({
  isStrongest,
  pattern,
}: {
  isStrongest: boolean;
  pattern: WeekdayScorePattern;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const locale = useLocale();
  const day = getScoreWeekdayLabel({ dayOfWeek: pattern.dayOfWeek, locale });
  const weekday = getScoreWeekdayMessageValue(pattern.dayOfWeek);
  const hasAnswers = pattern.totalAnswers > 0;
  const score = formatMetricPercent({ format, value: pattern.score });
  const Icon = isStrongest ? Crown : CalendarDays;

  return (
    <div aria-live="polite" className="flex items-center gap-3" role="status">
      <span className="bg-score/10 text-score flex size-9 shrink-0 items-center justify-center rounded-full">
        <Icon aria-hidden="true" className="size-4.5" />
      </span>

      <div className="flex h-9 min-w-0 flex-col justify-center">
        <p className="text-sm leading-5 font-medium first-letter:uppercase">
          {isStrongest
            ? t(
                "You do better {weekday, select, sunday {on Sundays} monday {on Mondays} tuesday {on Tuesdays} wednesday {on Wednesdays} thursday {on Thursdays} friday {on Fridays} saturday {on Saturdays} other {on your best weekday}}",
                { weekday },
              )
            : t("{day} performance", { day })}
        </p>
        <p className="text-muted-foreground text-xs leading-4">
          {hasAnswers
            ? t("{score} across {count, plural, one {# answer} other {# answers}}", {
                count: pattern.totalAnswers,
                score,
              })
            : t("No answers")}
        </p>
      </div>
    </div>
  );
}

/** Presents every weekday as one interactive weekly performance rhythm. */
export function WeekdayRhythm({
  patterns,
  strongestDayOfWeek,
}: {
  patterns: WeekdayScorePattern[];
  strongestDayOfWeek: number | null;
}) {
  const t = useExtracted();

  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState(() =>
    getInitialDayOfWeek({ patterns, strongestDayOfWeek }),
  );

  const selectedPattern = getSelectedPattern({ dayOfWeek: selectedDayOfWeek, patterns });

  return (
    <PatternSection aria-labelledby={WEEKLY_RHYTHM_TITLE_ID}>
      <PatternSectionHeader>
        <PatternSectionTitle id={WEEKLY_RHYTHM_TITLE_ID}>{t("Weekly rhythm")}</PatternSectionTitle>
        <PatternSectionDescription>
          {t("Accuracy by weekday over the past 90 days")}
        </PatternSectionDescription>
      </PatternSectionHeader>

      <div className="grid grid-cols-7 gap-0.5 sm:gap-2">
        {patterns.map((pattern) => (
          <WeekdayRhythmItem
            isSelected={pattern.dayOfWeek === selectedDayOfWeek}
            isStrongest={pattern.dayOfWeek === strongestDayOfWeek}
            key={pattern.dayOfWeek}
            onSelect={() => setSelectedDayOfWeek(pattern.dayOfWeek)}
            pattern={pattern}
          />
        ))}
      </div>

      <WeekdayRhythmStatus
        isStrongest={selectedPattern.dayOfWeek === strongestDayOfWeek}
        pattern={selectedPattern}
      />
    </PatternSection>
  );
}
