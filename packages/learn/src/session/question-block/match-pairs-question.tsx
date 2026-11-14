"use client";

import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { MatchEntry } from "../../_components/match-entry";
import { useFocusMainActionWhenComplete } from "../../_components/question-actions";
import { ItemLine } from "../../questions/item-text";
import { useSpokenText } from "../../rich-text/use-spoken-text";

type Matches = number[];

const UNMATCHED = -1;

function getLeftState({ matched, selected }: { matched: boolean; selected: boolean }) {
  if (matched) {
    return "matched";
  }

  return selected ? "selected" : "idle";
}

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
  const spoken = useSpokenText();
  const [matches, setMatches] = useState<Matches>(() => left.map(() => UNMATCHED));
  const [selected, setSelected] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useFocusMainActionWhenComplete({
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
    count: left.length + right.length,
    enabled: !disabled,
    onPick: (index) => {
      if (index < left.length) {
        if (matches[index] !== UNMATCHED) {
          return false;
        }

        pickLeft(index);
        return;
      }

      const rightIndex = index - left.length;

      if (selected === null || matches.includes(rightIndex)) {
        return false;
      }

      pickRight(rightIndex);
    },
  });

  return (
    <div className="grid grid-cols-2 gap-2 text-sm" ref={listRef}>
      <ul aria-label={t("Match these")} className="flex flex-col gap-2">
        {left.map((entry, index) => (
          <li key={entry}>
            <MatchEntry
              disabled={disabled}
              index={index}
              onClick={() => pickLeft(index)}
              pair={index}
              state={getLeftState({
                matched: matches[index] !== UNMATCHED,
                selected: selected === index,
              })}
            >
              <ItemLine text={entry} />
            </MatchEntry>
          </li>
        ))}
      </ul>

      <ul aria-label={t("With these")} className="flex flex-col gap-2">
        {right.map((entry, index) => {
          const owner = matches.indexOf(index);
          const matched = owner !== UNMATCHED;

          return (
            <li key={entry}>
              <MatchEntry
                label={
                  matched
                    ? t("{entry}, matched with {other}", {
                        entry: spoken.inline(entry),
                        other: spoken.inline(left[owner] ?? ""),
                      })
                    : spoken.inline(entry)
                }
                disabled={disabled || (selected === null && !matched)}
                index={left.length + index}
                onClick={() => pickRight(index)}
                pair={owner}
                state={matched ? "matched" : "idle"}
              >
                <ItemLine text={entry} />
              </MatchEntry>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
