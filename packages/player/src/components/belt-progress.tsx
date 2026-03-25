"use client";

import { BeltIndicator, beltColorClasses } from "@zoonk/ui/components/belt-indicator";
import { ProgressIndicator, ProgressRoot, ProgressTrack } from "@zoonk/ui/components/progress";
import { cn } from "@zoonk/ui/lib/utils";
import { calculateBeltLevel, getBeltProgressPercent } from "@zoonk/utils/belt-level";
import { useExtracted } from "next-intl";
import { usePlayerNavigation } from "../player-context";
import { PlayerLink } from "../player-link";
import { useBeltColorLabel } from "../use-belt-color-label";

export function BeltProgressHint({
  brainPower,
  newTotalBp,
}: {
  brainPower: number;
  newTotalBp: number;
}) {
  const t = useExtracted();
  const { levelHref } = usePlayerNavigation();
  const currentBelt = calculateBeltLevel(newTotalBp);
  const previousBelt = calculateBeltLevel(newTotalBp - brainPower);
  const didLevelUp =
    currentBelt.color !== previousBelt.color || currentBelt.level !== previousBelt.level;
  const colorLabel = useBeltColorLabel(currentBelt.color);
  const currentPercent = getBeltProgressPercent(currentBelt);

  if (currentBelt.isMaxLevel || !levelHref) {
    return null;
  }

  return (
    <PlayerLink className="flex flex-col gap-1.5" href={levelHref}>
      <div className="flex items-center gap-1.5">
        <BeltIndicator
          className={didLevelUp ? "animate-dot-pulse motion-reduce:animate-none" : undefined}
          color={currentBelt.color}
          label={t("{color} belt", { color: colorLabel })}
          size="sm"
        />
        <span className="text-foreground text-sm font-medium">
          {t("{color} Belt — Level {level}", {
            color: colorLabel,
            level: String(currentBelt.level),
          })}
        </span>
      </div>
      <ProgressRoot aria-label={t("Level progress")} value={currentPercent}>
        <ProgressTrack className="h-1.5 overflow-hidden">
          <ProgressIndicator
            className={cn(
              beltColorClasses[currentBelt.color],
              "rounded-full",
              currentBelt.color === "white" && "ring-1 ring-black/10 ring-inset dark:ring-0",
              currentBelt.color === "black" && "dark:ring-1 dark:ring-white/10 dark:ring-inset",
              "duration-600 ease-out",
              "motion-reduce:duration-0",
            )}
          />
        </ProgressTrack>
      </ProgressRoot>
      <span className="text-muted-foreground text-xs tabular-nums">
        {t("{value} BP to level up", { value: String(currentBelt.bpToNextLevel) })}
      </span>
    </PlayerLink>
  );
}
