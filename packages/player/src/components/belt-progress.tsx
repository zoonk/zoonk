"use client";

import { BeltIndicator, beltColorClasses } from "@zoonk/ui/components/belt-indicator";
import { ProgressIndicator, ProgressRoot, ProgressTrack } from "@zoonk/ui/components/progress";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { calculateBeltLevel, getBeltProgressPercent } from "@zoonk/utils/belt-level";
import { useExtracted } from "next-intl";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePlayer } from "../player-context";
import { useBeltColorLabel } from "../use-belt-color-label";

type LevelUpPhase = "filling" | "resetting" | "done";

/**
 * Triggers animation start after first paint.
 *
 * This is a legitimate useEffect: we need the browser to paint the
 * initial state (previousPercent) before transitioning to the target.
 * No event handler exists for "component finished painting."
 */
function useAnimationStarted(): boolean {
  const [started, setStarted] = useState(false);
  useEffect(() => setStarted(true), []);
  return started;
}

function getDisplayPercent(phase: LevelUpPhase, currentPercent: number): number {
  if (phase === "filling") {
    return 100;
  }
  if (phase === "resetting") {
    return 0;
  }
  return currentPercent;
}

export function BeltProgressHint({
  brainPower,
  newTotalBp,
}: {
  brainPower: number;
  newTotalBp: number;
}) {
  const t = useExtracted();
  const { levelHref } = usePlayer();
  const currentBelt = calculateBeltLevel(newTotalBp);
  const previousBelt = calculateBeltLevel(newTotalBp - brainPower);
  const didLevelUp =
    currentBelt.color !== previousBelt.color || currentBelt.level !== previousBelt.level;
  const currentColorLabel = useBeltColorLabel(currentBelt.color);
  const previousColorLabel = useBeltColorLabel(previousBelt.color);

  const currentPercent = getBeltProgressPercent(currentBelt);
  const previousPercent = getBeltProgressPercent(previousBelt);

  const animationStarted = useAnimationStarted();
  const [levelUpPhase, setLevelUpPhase] = useState<LevelUpPhase>("filling");

  const showCurrentBelt = !didLevelUp || levelUpPhase !== "filling";
  const displayColor = showCurrentBelt ? currentBelt.color : previousBelt.color;
  const displayLabel = showCurrentBelt ? currentColorLabel : previousColorLabel;
  const displayLevel = showCurrentBelt ? currentBelt.level : previousBelt.level;

  const displayPercent = getDisplayPercent(
    animationStarted && didLevelUp ? levelUpPhase : "done",
    currentPercent,
  );

  const skipTransition = levelUpPhase === "resetting";

  function handleTransitionEnd() {
    if (!didLevelUp || levelUpPhase !== "filling") {
      return;
    }
    // Two-frame sequence: first frame paints 0% with no transition,
    // second frame starts the transition to currentPercent.
    setLevelUpPhase("resetting");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setLevelUpPhase("done"));
    });
  }

  if (currentBelt.isMaxLevel || !levelHref) {
    return null;
  }

  return (
    <Link className="flex flex-col gap-1.5" href={levelHref}>
      <div className="flex items-center gap-1.5">
        <BeltIndicator
          className={didLevelUp ? "animate-dot-pulse motion-reduce:animate-none" : undefined}
          color={displayColor}
          label={displayLabel}
          size="sm"
        />
        <span className="text-foreground text-sm font-medium">
          {displayLabel} {t("Belt")} — {t("Level")} {displayLevel}
        </span>
      </div>
      <ProgressRoot
        aria-label={t("Level progress")}
        value={animationStarted ? displayPercent : previousPercent}
      >
        <ProgressTrack className="h-1.5">
          <ProgressIndicator
            className={cn(
              beltColorClasses[displayColor],
              skipTransition ? "duration-0" : "duration-600 ease-out",
              "motion-reduce:duration-0",
            )}
            onTransitionEnd={handleTransitionEnd}
          />
        </ProgressTrack>
      </ProgressRoot>
      <span className="text-muted-foreground text-xs tabular-nums">
        {t("{value} BP to level up", { value: String(currentBelt.bpToNextLevel) })}
      </span>
    </Link>
  );
}

export function BeltProgressSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <Skeleton className="size-3 rounded-full" />
        <Skeleton className="h-4 w-36" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-4xl" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}
