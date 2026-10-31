"use client";

import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { useExtracted } from "next-intl";
import { type BlankState } from "./_utils/fill-blank-state";
import { WordBankOptionButton } from "./word-bank-option-content";

type WordTileData = { isUsed: boolean; key: string; option: WordBankOption };

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
    <div aria-label={t("Word bank")} className="flex flex-wrap gap-2.5" role="group">
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
