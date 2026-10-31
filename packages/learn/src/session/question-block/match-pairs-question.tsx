"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { ANSWER_TONE } from "../../_components/answer-tone";
import { toPlainItemLine } from "../../questions/_utils/item-text";
import { ItemLine } from "../../questions/item-text";
import { useFocusCheckWhenComplete } from "./question-actions";

type Matches = number[];

const UNMATCHED = -1;

function PairBadge({ number }: { number: number }) {
  return (
    <LineMarker aria-hidden="true">
      <span className="bg-foreground text-background flex size-6 items-center justify-center rounded-full font-mono text-xs font-medium tabular-nums">
        {number}
      </span>
    </LineMarker>
  );
}

function EntryText({ text }: { text: string }) {
  return (
    <span className="flex-1">
      <ItemLine text={text} />
    </span>
  );
}

const entryClass =
  "rounded-option ring-input focus-visible:outline-ring flex min-h-12 w-full items-start gap-2 px-3 py-3 text-left text-sm font-medium ring-1 transition-colors outline-none ring-inset focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 enabled:hover:bg-muted/60 disabled:cursor-default";

/** The host gets the pairs once all are matched, null before. */
export function MatchPairsQuestion({
  disabled,
  left,
  onChange,
  right,
}: {
  disabled: boolean;
  left: readonly string[];
  onChange: (answer: { matches: number[] } | null) => void;
  right: readonly string[];
}) {
  const t = useExtracted();
  const [matches, setMatches] = useState<Matches>(() => left.map(() => UNMATCHED));
  const [selected, setSelected] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useFocusCheckWhenComplete({
    complete: matches.every((match) => match !== UNMATCHED),
    containerRef: listRef,
  });

  const updateMatches = (next: Matches) => {
    setMatches(next);
    onChange(next.every((match) => match !== UNMATCHED) ? { matches: next } : null);
  };

  const pickLeft = (index: number) => {
    if (matches[index] !== UNMATCHED) {
      updateMatches(matches.map((match, position) => (position === index ? UNMATCHED : match)));
      return;
    }

    setSelected(selected === index ? null : index);
  };

  const pickRight = (rightIndex: number) => {
    const owner = matches.indexOf(rightIndex);

    if (owner !== UNMATCHED) {
      updateMatches(matches.map((match, position) => (position === owner ? UNMATCHED : match)));
      return;
    }

    if (selected === null) {
      return;
    }

    updateMatches(matches.map((match, position) => (position === selected ? rightIndex : match)));
    setSelected(null);
  };

  useNumberKeys({
    count: selected === null ? left.length : right.length,
    enabled: !disabled,
    onPick: (index) => (selected === null ? pickLeft(index) : pickRight(index)),
  });

  return (
    <div className="grid grid-cols-2 gap-3" ref={listRef}>
      <ul aria-label={t("Match these")} className="flex flex-col gap-2">
        {left.map((entry, index) => (
          <li key={entry}>
            <button
              aria-pressed={selected === index}
              className={cn(entryClass, selected === index && ANSWER_TONE.picked)}
              disabled={disabled}
              onClick={() => pickLeft(index)}
              type="button"
            >
              {matches[index] !== UNMATCHED && <PairBadge number={index + 1} />}
              <EntryText text={entry} />
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
                    ? toPlainItemLine(entry)
                    : t("{entry}, matched with {other}", {
                        entry: toPlainItemLine(entry),
                        other: toPlainItemLine(left[owner] ?? ""),
                      })
                }
                className={entryClass}
                disabled={disabled || (selected === null && owner === UNMATCHED)}
                onClick={() => pickRight(index)}
                type="button"
              >
                {owner !== UNMATCHED && <PairBadge number={owner + 1} />}
                <EntryText text={entry} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
