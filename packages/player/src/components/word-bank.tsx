"use client";

import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { useExtracted } from "next-intl";
import { createContext, use } from "react";
import { placeKeepingFocus } from "./_utils/word-bank-focus";
import { WordBankOptionButton } from "./word-bank-option-content";

type WordBankTile = { isUsed: boolean; key: string; option: WordBankOption };

/**
 * What a check adds (its feedback, "fix it yourself") when the bank waits above the action bar: it
 * goes right above the bank, in the room the bank leaves, so the bank holds still under the thumb.
 */
export const WordBankAboveContext = createContext<React.ReactNode>(null);

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
  const above = use(WordBankAboveContext);

  return (
    <div className="flex flex-col gap-4 max-lg:mt-auto">
      {above}
      <div
        aria-label={t("Word bank")}
        className="flex flex-wrap gap-2"
        data-slot="word-bank"
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
    </div>
  );
}
