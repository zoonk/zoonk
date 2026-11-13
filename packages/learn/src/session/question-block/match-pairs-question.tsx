"use client";

import { Kbd } from "@zoonk/ui/components/kbd";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { ignoreHeldEnter, useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { pickKey, shortcutKeys } from "@zoonk/ui/lib/shortcuts";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useRef, useState } from "react";
import { ANSWER_TONE } from "../../_components/answer-tone";
import { useFocusMainActionWhenComplete } from "../../_components/question-actions";
import { toPlainItemLine } from "../../questions/_utils/item-text";
import { ItemLine } from "../../questions/item-text";

type Matches = number[];

const UNMATCHED = -1;

/**
 * An entry starts with the key that picks it. Once matched, its pair's number takes the key's
 * place in the same box, so matching moves no text.
 */
function EntryMarker({ index, pair }: { index: number; pair: number }) {
  const key = pickKey(index);

  return (
    <LineMarker aria-hidden="true" className="w-6 justify-center">
      {pair === UNMATCHED && key && <Kbd>{key}</Kbd>}

      {pair !== UNMATCHED && (
        <span className="bg-foreground text-background flex size-6 items-center justify-center rounded-full font-mono text-xs font-medium tabular-nums">
          {pair + 1}
        </span>
      )}
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
  "rounded-xl ring-input focus-visible:outline-ring flex min-h-12 w-full items-start gap-2 px-3 py-3 text-left text-sm font-medium ring-1 transition-colors outline-none ring-inset select-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 enabled:hover:bg-muted/60 disabled:cursor-default";

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
    count: selected === null ? left.length : right.length,
    enabled: !disabled,
    onPick: (index) => {
      if (selected === null) {
        pickLeft(index);
        return;
      }

      // A matched entry on this side shows its pair's number, not a key.
      if (matches.includes(index)) {
        return false;
      }

      pickRight(index);
    },
  });

  return (
    <div className="grid grid-cols-2 gap-3" ref={listRef}>
      <ul aria-label={t("Match these")} className="flex flex-col gap-2">
        {left.map((entry, index) => (
          <li key={entry}>
            <button
              aria-keyshortcuts={
                !disabled && selected === null ? shortcutKeys("pick", index) : undefined
              }
              aria-pressed={selected === index}
              className={cn(entryClass, selected === index && ANSWER_TONE.picked)}
              disabled={disabled}
              onClick={() => pickLeft(index)}
              onKeyDown={ignoreHeldEnter}
              type="button"
            >
              <EntryMarker index={index} pair={matches[index] === UNMATCHED ? UNMATCHED : index} />
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
                aria-keyshortcuts={
                  !disabled && selected !== null && owner === UNMATCHED
                    ? shortcutKeys("pick", index)
                    : undefined
                }
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
                onKeyDown={ignoreHeldEnter}
                type="button"
              >
                <EntryMarker index={index} pair={owner} />
                <EntryText text={entry} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
