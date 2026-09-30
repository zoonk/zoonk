"use client";

import { type ActivityContentFor } from "@zoonk/core/library/activities/templates";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { useFormatNumber } from "../_utils/use-format-number";
import { type FactChange, barShares, describeChange } from "./fact-change";

type Fields = ActivityContentFor<"beforeAfter">["fields"];
type State = Fields["before"];
type Fact = State["facts"][number];

const PERCENT = 100;

/** The change in words, computed from core's ratio: "8.3 times less", "+15%" or "No change". */
function useChangeLabel() {
  const t = useExtracted();
  const format = useFormatNumber();

  return (change: FactChange) => {
    if (change.kind === "same") {
      return t("No change");
    }

    if (change.kind === "percent") {
      return format(change.percent, { signed: true, unit: "%" });
    }

    return change.kind === "less"
      ? t("{times} times less", { times: format(change.times) })
      : t("{times} times more", { times: format(change.times) });
  };
}

/**
 * Starts the after bars at the before length and lets them move to their own on the next frame,
 * so revealing the after state shows the change happen. With reduced motion there's no
 * transition, so they simply appear at their length.
 */
function useSettled(): boolean {
  const [isSettled, setIsSettled] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsSettled(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return isSettled;
}

function FactRow({
  change,
  fact,
  isAfter,
  isHighlighted,
  other,
}: {
  change: FactChange | null;
  fact: Fact;
  isAfter: boolean;
  isHighlighted: boolean;
  other: Fact | undefined;
}) {
  const format = useFormatNumber();
  const changeLabel = useChangeLabel();
  const isSettled = useSettled();
  const otherValue = other?.value ?? 0;
  const shares = isAfter ? barShares(otherValue, fact.value) : barShares(fact.value, otherValue);
  const share = isAfter && isSettled ? shares.after : shares.before;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className={cn("text-sm", isAfter ? "text-foreground" : "text-muted-foreground")}>
          {fact.label}
        </span>
        <span className={cn("text-base font-bold tabular-nums", isAfter && "text-viz-accent")}>
          {format(fact.value, { unit: fact.unit })}
        </span>
      </div>

      <div
        aria-hidden="true"
        className={cn("h-1.5 overflow-hidden rounded-full", isAfter ? "bg-background" : "bg-muted")}
      >
        <div
          className={cn(
            "h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out",
            isAfter ? "bg-viz-accent" : "bg-muted-foreground",
          )}
          style={{ width: `${share * PERCENT}%` }}
        />
      </div>

      {change && (
        <span
          className={cn(
            "w-fit rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
            isHighlighted ? "bg-success/10 text-success" : "bg-background text-foreground",
          )}
        >
          {changeLabel(change)}
        </span>
      )}
    </div>
  );
}

/**
 * One state: its label, each fact with a bar on the scale it shares with the other state, and
 * what it looked like. The after state is tinted so the two read as a pair; once checked, its
 * facts carry the change code computed.
 */
export function BeforeAfterState({
  highlightId,
  isAfter,
  other,
  ratios,
  ref,
  state,
}: {
  highlightId: string | null;
  isAfter: boolean;
  other: State;
  /** After divided by before per fact, shown once checked. */
  ratios: Record<string, number | null> | null;
  ref?: React.Ref<HTMLElement>;
  state: State;
}) {
  return (
    <section
      aria-label={state.label}
      ref={ref}
      tabIndex={-1}
      className={cn(
        "flex flex-col gap-3 rounded-2xl p-4 outline-none",
        isAfter
          ? "bg-viz-accent-soft motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2"
          : "bg-background",
      )}
    >
      <p
        className={cn(
          "text-sm font-semibold",
          isAfter ? "text-viz-accent" : "text-muted-foreground",
        )}
      >
        {state.label}
      </p>

      {state.facts.map((fact) => {
        const ratio = ratios?.[fact.id] ?? null;

        return (
          <FactRow
            change={ratio === null ? null : describeChange(ratio)}
            fact={fact}
            isAfter={isAfter}
            isHighlighted={fact.id === highlightId}
            key={fact.id}
            other={other.facts.find((item) => item.id === fact.id)}
          />
        );
      })}

      <p className="text-sm leading-snug">
        <LessonRichText text={state.description} />
      </p>
    </section>
  );
}
