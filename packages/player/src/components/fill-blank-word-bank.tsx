"use client";

import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type BlankState } from "./_utils/fill-blank-state";
import { WordBankOptionButton } from "./word-bank-option-content";

type WordTileData = { isUsed: boolean; key: string; option: WordBankOption };

/**
 * Duplicate options need occurrence counting so selecting one copy of a word
 * hides only one matching tile and leaves any additional copies available.
 */
function getWordOccurrenceNumber({
  index,
  option,
  options,
}: {
  index: number;
  option: WordBankOption;
  options: WordBankOption[];
}): number {
  return options.slice(0, index + 1).filter((item) => item.word === option.word).length;
}

/**
 * Duplicate words are valid, so a tile is used only after that many copies of
 * the same word are already placed in blanks.
 */
function isWordTileUsed({
  blanks,
  occurrenceNumber,
  option,
}: {
  blanks: BlankState;
  occurrenceNumber: number;
  option: WordBankOption;
}): boolean {
  const usedCount = blanks.filter((blank) => blank === option.word).length;
  return usedCount >= occurrenceNumber;
}

/**
 * Builds the render model in one place so click selection and duplicate
 * visibility use the same occurrence-counting rule.
 */
function getWordTileData({
  blanks,
  index,
  option,
  options,
}: {
  blanks: BlankState;
  index: number;
  option: WordBankOption;
  options: WordBankOption[];
}): WordTileData {
  const occurrenceNumber = getWordOccurrenceNumber({ index, option, options });

  return {
    isUsed: isWordTileUsed({ blanks, occurrenceNumber, option }),
    key: `${option.word}-${index}`,
    option,
  };
}

/**
 * Keeps every fill-blank option in the bank so used words can become disabled
 * placeholders instead of causing the remaining options to shift position.
 */
export function FillBlankWordBank({
  blanks,
  disabled,
  onPlaceWord,
  options,
}: {
  blanks: BlankState;
  disabled: boolean;
  onPlaceWord: (word: string) => void;
  options: WordBankOption[];
}) {
  const t = useExtracted();
  const tiles = options.map((option, index) => getWordTileData({ blanks, index, option, options }));

  return (
    <div
      aria-label={t("Word bank")}
      className={cn("flex flex-wrap gap-2.5", disabled && "pointer-events-none opacity-50")}
      role="group"
    >
      {tiles.map((tile) => (
        <WordBankOptionButton
          disabled={disabled}
          isSelected={tile.isUsed}
          key={tile.key}
          onToggle={() => onPlaceWord(tile.option.word)}
          option={tile.option}
        />
      ))}
    </div>
  );
}
