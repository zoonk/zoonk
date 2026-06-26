"use client";

import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useCallback } from "react";
import { MAX_NUMBER_KEY_SHORTCUT, getNumberKeyShortcut } from "../player-shortcuts";
import { useOptionKeyboard } from "../use-option-keyboard";
import { type BlankState, type WordPlacement } from "./_utils/fill-blank-state";
import { WordBankOptionButton } from "./word-bank-option-content";

type WordTileData = {
  index: number;
  isUsed: boolean;
  key: string;
  occurrenceNumber: number;
  option: WordBankOption;
  shortcut: string | null;
};

/**
 * Restored results do not have source indexes, so duplicates fall back to the
 * same occurrence counting used before shortcuts were introduced.
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
 * Source-index matches make each numbered tile reversible. Occurrence fallback
 * keeps server-provided answer strings readable when the component is restored
 * from a checked result.
 */
function isWordTileUsed({
  blanks,
  index,
  occurrenceNumber,
  option,
}: {
  blanks: BlankState;
  index: number;
  occurrenceNumber: number;
  option: WordBankOption;
}): boolean {
  const hasSourceIndexes = blanks.some((blank) => typeof blank?.sourceIndex === "number");

  if (hasSourceIndexes) {
    return blanks.some((blank) => blank?.sourceIndex === index);
  }

  const usedCount = blanks.filter((blank) => blank?.word === option.word).length;
  return usedCount >= occurrenceNumber;
}

/**
 * Builds one model for rendering and keyboard selection so click and number
 * shortcuts stay aligned even when generated word banks contain duplicates.
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
    index,
    isUsed: isWordTileUsed({ blanks, index, occurrenceNumber, option }),
    key: `${option.word}-${index}`,
    occurrenceNumber,
    option,
    shortcut: getNumberKeyShortcut(index),
  };
}

/**
 * Finds the blank controlled by a used bank tile. Exact source indexes are the
 * normal path, with occurrence matching for restored string-only answers.
 */
function getBlankIndexForTile({
  blanks,
  tile,
}: {
  blanks: BlankState;
  tile: WordTileData;
}): number | null {
  const sourceIndexMatch = blanks.findIndex((blank) => blank?.sourceIndex === tile.index);

  if (sourceIndexMatch !== -1) {
    return sourceIndexMatch;
  }

  if (blanks.some((blank) => typeof blank?.sourceIndex === "number")) {
    return null;
  }

  const matchingIndexes = blanks.flatMap((blank, index) =>
    blank?.word === tile.option.word ? [index] : [],
  );

  return matchingIndexes[tile.occurrenceNumber - 1] ?? null;
}

/**
 * Renders the fill-blank word bank and owns its number-key toggle behavior so
 * FillBlankStep can stay focused on the template and answer contract.
 */
export function FillBlankWordBank({
  blanks,
  disabled,
  onPlaceWord,
  onRemoveWord,
  options,
}: {
  blanks: BlankState;
  disabled: boolean;
  onPlaceWord: (placement: WordPlacement) => void;
  onRemoveWord: (blankIndex: number) => void;
  options: WordBankOption[];
}) {
  const t = useExtracted();
  const tiles = options.map((option, index) => getWordTileData({ blanks, index, option, options }));

  const handleToggleTile = useCallback(
    (tile: WordTileData) => {
      if (!tile.isUsed) {
        onPlaceWord({ option: tile.option, sourceIndex: tile.index });
        return;
      }

      const blankIndex = getBlankIndexForTile({ blanks, tile });

      if (blankIndex !== null) {
        onRemoveWord(blankIndex);
      }
    },
    [blanks, onPlaceWord, onRemoveWord],
  );

  useOptionKeyboard({
    enabled: !disabled,
    onSelect: (index) => {
      const tile = tiles[index];

      if (!tile) {
        return;
      }

      handleToggleTile(tile);
    },
    optionCount: Math.min(options.length, MAX_NUMBER_KEY_SHORTCUT),
  });

  return (
    <div
      aria-label={t("Word bank")}
      className={cn("flex flex-wrap gap-2.5", disabled && "pointer-events-none opacity-50")}
      role="group"
    >
      {tiles.map((tile) => (
        <WordBankOptionButton
          disabled={disabled}
          isUsed={tile.isUsed}
          key={tile.key}
          onToggle={() => handleToggleTile(tile)}
          option={tile.option}
          shortcut={tile.shortcut}
        />
      ))}
    </div>
  );
}
