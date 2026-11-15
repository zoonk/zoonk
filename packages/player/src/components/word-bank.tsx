"use client";

import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { useExtracted } from "next-intl";
import { createContext, use, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { placeKeepingFocus } from "./_utils/word-bank-focus";
import { WordBankOptionButton } from "./word-bank-option-content";

type WordBankTile = { isUsed: boolean; key: string; option: WordBankOption };

/** What a check adds to a word bank's step: its feedback, or "fix it yourself". */
export const WordBankCheckContext = createContext<React.ReactNode>(null);

/** Tailwind's `lg`: below it the bank waits above the action bar. */
const LG_QUERY = "(min-width: 64rem)";

function watchLg(notify: () => void) {
  const media = globalThis.matchMedia(LG_QUERY);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}

function useFromLg(): boolean {
  return useSyncExternalStore(
    watchLg,
    () => globalThis.matchMedia(LG_QUERY).matches,
    () => false,
  );
}

/**
 * Moving a node in the page drops the focus inside it in some browsers, so what the check added
 * gets back the control the learner was on when crossing `lg` moves it: only while focus was still
 * in it, and only when the move left the page with none. Focus elsewhere (Continue, the bar) stays.
 */
function useFocusKeptAcross({
  fromLg,
  slot,
}: {
  fromLg: boolean;
  slot: React.RefObject<HTMLDivElement | null>;
}) {
  const focused = useRef<HTMLElement | null>(null);
  const placed = useRef(fromLg);

  useLayoutEffect(() => {
    if (placed.current === fromLg) {
      return;
    }

    placed.current = fromLg;
    const last = focused.current;

    const dropped = document.activeElement === null || document.activeElement === document.body;

    if (dropped && last?.isConnected && slot.current?.contains(last)) {
      last.focus({ preventScroll: true });
    }
  }, [fromLg, slot]);

  return {
    onBlur: (event: React.FocusEvent<HTMLDivElement>) => {
      const next = event.relatedTarget;

      if (next instanceof Node && !event.currentTarget.contains(next)) {
        focused.current = null;
      }
    },
    onFocus: (event: React.FocusEvent<HTMLDivElement>) => {
      focused.current = event.target;
    },
  };
}

export function WordBank<Tile extends WordBankTile>({
  disabled,
  fillsAnswer,
  onPlace,
  tiles,
}: {
  disabled: boolean;
  /** The next word placed completes the answer, so a keyboard's focus moves on to Check. */
  fillsAnswer: boolean;
  onPlace: (tile: Tile) => void;
  tiles: Tile[];
}) {
  const t = useExtracted();
  const added = use(WordBankCheckContext);
  const fromLg = useFromLg();
  const slot = useRef<HTMLDivElement>(null);
  const keptFocus = useFocusKeptAcross({ fromLg, slot });

  const bank = (
    <div
      aria-label={t("Word bank")}
      className="flex flex-wrap gap-2"
      data-slot="word-bank"
      key="bank"
      role="group"
    >
      {tiles.map((tile) => (
        <WordBankOptionButton
          disabled={disabled}
          isSelected={tile.isUsed}
          key={tile.key}
          onToggle={(event) =>
            placeKeepingFocus({ event, fillsAnswer, place: () => onPlace(tile) })
          }
          option={tile.option}
        />
      ))}
    </div>
  );

  const check = added && (
    <div
      className="contents"
      key="check"
      onBlur={keptFocus.onBlur}
      onFocus={keptFocus.onFocus}
      ref={slot}
    >
      {added}
    </div>
  );

  // What a check adds takes the room the bank leaves, so the bank holds still: above it below
  // `lg`, where the bank waits above the action bar, and under it from `lg`. One keyed node either
  // way, so crossing `lg` moves it with what the learner did in it.
  return (
    <div className="flex flex-col gap-4 max-lg:mt-auto">
      {fromLg ? [bank, check] : [check, bank]}
    </div>
  );
}
