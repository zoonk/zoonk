"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { CellValue, type GridTraits, Trait } from "./grid-parts";

/** The values to put in the highlighted cell, each genotype with the trait it shows. */
export function GridPalette({
  activeCell,
  isAllele,
  onPick,
  options,
  traits,
}: {
  activeCell: number | null;
  isAllele: boolean;
  onPick: (value: string) => void;
  options: readonly string[];
  traits: GridTraits;
}) {
  const t = useExtracted();
  const questionId = useId();
  const isDisabled = activeCell === null;
  const number = String((activeCell ?? 0) + 1);

  function question() {
    if (isDisabled) {
      return t("Every square is filled. Tap one to change it.");
    }

    return isAllele
      ? t("Which genotype goes in square {number}?", { number })
      : t("What goes in square {number}?", { number });
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium" id={questionId}>
        {question()}
      </p>

      {/* The question names the group, so each option is named by what it shows. */}
      <div
        aria-labelledby={questionId}
        className={cn("grid gap-2", isAllele ? "grid-cols-3" : "grid-cols-4")}
        role="group"
      >
        {options.map((option) => (
          <button
            aria-disabled={isDisabled}
            className={cn(
              "bg-background focus-visible:ring-ring/50 flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border outline-none focus-visible:ring-[3px]",
              isDisabled ? "opacity-60" : "hover:bg-accent",
            )}
            key={option}
            onClick={() => {
              if (!isDisabled) {
                onPick(option);
              }
            }}
            type="button"
          >
            <CellValue className="text-base" isAllele={isAllele} value={option} />
            <Trait traits={traits} value={option} />
          </button>
        ))}
      </div>
    </div>
  );
}
