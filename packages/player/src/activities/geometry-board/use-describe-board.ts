"use client";

import { useExtracted } from "next-intl";
import { useFormatNumber } from "../_utils/use-format-number";
import { type BoardMeasure } from "./board-geometry";
import { type BoardReading } from "./board-measure";

/**
 * What the board measures right now, in words: the canvas's text alternative and each corner's
 * spoken value, so moving a corner with a screen reader says what changed.
 */
export function useDescribeBoard() {
  const t = useExtracted();
  const format = useFormatNumber();

  return ({
    hideTotal,
    measure,
    reading,
  }: {
    hideTotal: boolean;
    measure: BoardMeasure;
    reading: BoardReading;
  }): string => {
    const unit = measure === "angleSum" ? "°" : undefined;
    const parts = reading.parts.map((part) => format(part, { unit })).join(", ");
    const total = format(reading.total, { unit });

    if (measure === "angleSum") {
      return hideTotal
        ? t("Angles: {parts}.", { parts })
        : t("Angles: {parts}, adding up to {total}.", { parts, total });
    }

    if (measure === "perimeter") {
      return hideTotal
        ? t("Sides: {parts}.", { parts })
        : t("Sides: {parts}, adding up to a perimeter of {total}.", { parts, total });
    }

    if (measure === "area") {
      return hideTotal ? "" : t("Area: {total}.", { total });
    }

    return hideTotal
      ? t("Squares on the two shorter sides: {parts}.", { parts })
      : t("Squares on the two shorter sides: {parts}. Square on the longest side: {total}.", {
          parts,
          total,
        });
  };
}
