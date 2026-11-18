"use client";

import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useNumberKeys } from "@zoonk/ui/hooks/keyboard";
import { shortcutKeys } from "@zoonk/ui/lib/shortcuts";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { usePlayerInteractionState } from "../../player-context";
import { ACTIVITY_BOX_CLASS } from "../_components/activity-canvas";
import { ActivityCheckQuestion } from "../_components/activity-check-question";
import { useCanvasNumberKeys } from "../_utils/canvas-question";
import { CellValue, type GridTraits, Trait } from "./grid-parts";

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
  const interaction = usePlayerInteractionState();

  useCanvasNumberKeys(!isDisabled);

  useNumberKeys({
    count: options.length,
    enabled: !isDisabled && interaction !== "paused",
    onPick: (index) => {
      const option = options[index];

      if (option === undefined) {
        return false;
      }

      onPick(option);
    },
  });

  return (
    <div className="flex flex-col gap-2">
      <ActivityCheckQuestion id={questionId}>
        {isDisabled
          ? t("Every square is filled. Tap one to change it.")
          : t("What goes in the highlighted square?")}
      </ActivityCheckQuestion>

      <div
        aria-labelledby={questionId}
        className={cn("grid gap-2", isAllele ? "grid-cols-3" : "grid-cols-4")}
        role="group"
      >
        {options.map((option, index) => (
          <button
            aria-disabled={isDisabled}
            aria-keyshortcuts={isDisabled ? undefined : shortcutKeys("pick", index)}
            className={cn(
              ACTIVITY_BOX_CLASS,
              "focus-visible:ring-ring/50 relative flex min-h-14 flex-col items-center justify-center gap-0.5 outline-none select-none focus-visible:ring-[3px]",
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
            {!isDisabled && (
              <ShortcutKbd className="absolute inset-e-1 top-1" index={index} shortcut="pick" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
