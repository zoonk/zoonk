"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { Genotype, Trait } from "./punnett-parts";

/** The genotypes to put in the highlighted square, each with the trait it shows. */
export function PunnettPalette({
  activeCell,
  onPick,
  options,
  phenotypes,
}: {
  activeCell: number | null;
  onPick: (value: string) => void;
  options: readonly string[];
  phenotypes: { dominant: string; recessive: string };
}) {
  const t = useExtracted();
  const isDisabled = activeCell === null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">
        {isDisabled
          ? t("Every square is filled. Tap one to change it.")
          : t("Which genotype goes in square {number}?", { number: String(activeCell + 1) })}
      </p>

      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            aria-disabled={isDisabled}
            aria-label={
              isDisabled
                ? option
                : t("Put {genotype} in square {number}", {
                    genotype: option,
                    number: String(activeCell + 1),
                  })
            }
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
            <Genotype className="text-base" value={option} />
            <Trait phenotypes={phenotypes} value={option} />
          </button>
        ))}
      </div>
    </div>
  );
}
