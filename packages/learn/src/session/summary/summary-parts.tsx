"use client";

import { useExtracted, useFormatter } from "next-intl";
import { Meter } from "../../_components/meter";
import { useFormatShare } from "../../_utils/percent";
import { useStateLabel } from "../../content/use-state-label";
import { useSessionSummary } from "./summary-context";

const PERCENT = 100;

/** "45 min · 26 questions · 81% correct": the session in one line. */
export function useSummaryLine(): string {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const { summary } = useSessionSummary();

  const parts = [
    // A day stopped early can be shorter than a minute; "0 min" would read as nothing done.
    summary.minutes > 0
      ? t("{minutes} min", { minutes: String(summary.minutes) })
      : t("Under a minute"),
    summary.questions > 0 &&
      t("{count, plural, one {# question} other {# questions}}", { count: summary.questions }),
    summary.accuracy !== null && t("{share} correct", { share: formatShare(summary.accuracy) }),
  ].filter(Boolean);

  return parts.join(" · ");
}

/** Preparation before and after the session, as one bar with the gain lit. */
export function PreparationChange() {
  const t = useExtracted();
  const formatShare = useFormatShare();
  const { summary } = useSessionSummary();
  const { after, before } = summary.preparation;

  if (after === null) {
    return null;
  }

  const start = before ?? after;

  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{t("Preparation")}</span>
        <span className="tabular-nums">
          {before !== null && before !== after && (
            <span className="text-muted-foreground">
              {t("{before} → ", { before: formatShare(before) })}
            </span>
          )}
          <span className="font-semibold">{formatShare(after)}</span>
        </span>
      </p>

      <Meter className="relative h-2">
        <div
          className="bg-foreground in-data-[mode=fun]:bg-fun-fg2 absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${Math.min(start, after) * PERCENT}%` }}
        />
        {after > start && (
          <div
            className="bg-success in-data-[mode=fun]:bg-fun-lime absolute inset-y-0 rounded-full"
            style={{ left: `${start * PERCENT}%`, width: `${(after - start) * PERCENT}%` }}
          />
        )}
      </Meter>
    </div>
  );
}

/** "Percentages went from Learning to Solid": each skill that moved, in the same words as Content. */
export function SkillMoves() {
  const t = useExtracted();
  const stateLabel = useStateLabel();
  const { summary } = useSessionSummary();

  if (summary.skillsMoved.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-1.5 text-sm">
      {summary.skillsMoved.map((move) => (
        <li key={move.skillId}>
          {t("{skill} went from {from} to {to}", {
            from: stateLabel({ state: move.from }),
            skill: move.name,
            to: stateLabel({ state: move.to }),
          })}
        </li>
      ))}
    </ul>
  );
}

/** When things come back: "9 cards come back on Friday". Only the first date, the soonest. */
export function ComesBackLine() {
  const t = useExtracted();
  const format = useFormatter();
  const { summary } = useSessionSummary();
  const first = summary.comesBack[0];

  if (!first) {
    return null;
  }

  return (
    <p className="text-sm">
      {t("{count, plural, one {# idea comes back on {day}} other {# ideas come back on {day}}}", {
        count: first.skills,
        day: format.dateTime(first.date, { timeZone: "UTC", weekday: "long" }),
      })}
    </p>
  );
}
