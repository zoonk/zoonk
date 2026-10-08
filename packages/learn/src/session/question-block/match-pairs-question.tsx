"use client";

import { Button } from "@zoonk/ui/components/button";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { useEnterKey, useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { type StudyQuestionAnswer } from "../session-types";

/** Each left entry's pick, as an index into the right column; -1 while unmatched. */
type Matches = number[];

const UNMATCHED = -1;

function PairBadge({ number }: { number: number }) {
  return (
    <LineMarker aria-hidden="true">
      <span className="bg-foreground text-background flex size-6 items-center justify-center rounded-full text-xs font-bold tabular-nums">
        {number}
      </span>
    </LineMarker>
  );
}

const entryClass =
  "focus-visible:ring-ring bg-background flex min-h-12 w-full items-start gap-2 rounded-2xl border px-3 py-3.5 text-left text-sm font-medium outline-none focus-visible:ring-2 disabled:cursor-default";

/**
 * Once the last pair is matched from the keyboard, focus moves to Check, so Enter checks instead
 * of undoing the pair that was just made.
 */
function useFocusCheckWhenComplete({
  complete,
  listRef,
}: {
  complete: boolean;
  listRef: React.RefObject<HTMLDivElement | null>;
}) {
  const checkRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (complete && listRef.current?.contains(document.activeElement)) {
      checkRef.current?.focus();
    }
  }, [complete, listRef]);

  return checkRef;
}

/**
 * Match pairs: pick an entry on the left, then its match on the right. Tapping a matched entry
 * undoes it. Every entry is a button, so it works the same with a keyboard; number keys pick in
 * the column in play (the left one, then the right one) and Enter checks once all are matched.
 */
export function MatchPairsQuestion({
  disabled,
  left,
  onAnswer,
  right,
}: {
  disabled: boolean;
  left: string[];
  onAnswer: (answer: StudyQuestionAnswer) => void;
  right: string[];
}) {
  const t = useExtracted();
  const [matches, setMatches] = useState<Matches>(() => left.map(() => UNMATCHED));
  const [selected, setSelected] = useState<number | null>(null);
  const complete = matches.every((match) => match !== UNMATCHED);
  const listRef = useRef<HTMLDivElement>(null);
  const checkRef = useFocusCheckWhenComplete({ complete, listRef });
  const check = () => onAnswer({ matches });

  const pickLeft = (index: number) => {
    if (matches[index] !== UNMATCHED) {
      setMatches(matches.map((match, position) => (position === index ? UNMATCHED : match)));
      return;
    }

    setSelected(selected === index ? null : index);
  };

  const pickRight = (rightIndex: number) => {
    const owner = matches.indexOf(rightIndex);

    if (owner !== UNMATCHED) {
      setMatches(matches.map((match, position) => (position === owner ? UNMATCHED : match)));
      return;
    }

    if (selected === null) {
      return;
    }

    setMatches(matches.map((match, position) => (position === selected ? rightIndex : match)));
    setSelected(null);
  };

  useNumberKeys({
    count: selected === null ? left.length : right.length,
    enabled: !disabled,
    onPick: (index) => (selected === null ? pickLeft(index) : pickRight(index)),
  });

  useEnterKey(check, { enabled: !disabled && complete });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3" ref={listRef}>
        <ul aria-label={t("Match these")} className="flex flex-col gap-2">
          {left.map((entry, index) => (
            <li key={entry}>
              <button
                aria-pressed={selected === index}
                className={cn(
                  entryClass,
                  selected === index && "border-foreground ring-foreground ring-1",
                )}
                disabled={disabled}
                onClick={() => pickLeft(index)}
                type="button"
              >
                {matches[index] !== UNMATCHED && <PairBadge number={index + 1} />}
                <span className="flex-1">{entry}</span>
              </button>
            </li>
          ))}
        </ul>

        <ul aria-label={t("With these")} className="flex flex-col gap-2">
          {right.map((entry, index) => {
            const owner = matches.indexOf(index);

            return (
              <li key={entry}>
                <button
                  aria-label={
                    owner === UNMATCHED
                      ? entry
                      : t("{entry}, matched with {other}", { entry, other: left[owner] ?? "" })
                  }
                  className={entryClass}
                  disabled={disabled || (selected === null && owner === UNMATCHED)}
                  onClick={() => pickRight(index)}
                  type="button"
                >
                  {owner !== UNMATCHED && <PairBadge number={owner + 1} />}
                  <span className="flex-1">{entry}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <Button
        className="h-12 rounded-full"
        disabled={disabled || !complete}
        onClick={check}
        ref={checkRef}
        size="lg"
      >
        {t("Check")}
      </Button>
    </div>
  );
}
