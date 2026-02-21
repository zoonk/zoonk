"use client";

import { Badge } from "@zoonk/ui/components/badge";
import { BeltIndicator, beltColorClasses } from "@zoonk/ui/components/belt-indicator";
import { ProgressIndicator, ProgressRoot, ProgressTrack } from "@zoonk/ui/components/progress";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { calculateBeltLevel, getBeltProgressPercent } from "@zoonk/utils/belt-level";
import { BrainIcon, ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { usePlayer } from "../player-context";
import { useBeltColorLabel } from "../use-belt-color-label";

function formatEnergyDelta(delta: number): string {
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}`;
}

export function RewardBadges({
  brainPower,
  energyDelta,
  isChallenge,
}: {
  brainPower: number;
  energyDelta: number;
  isChallenge: boolean;
}) {
  const t = useExtracted();
  const isHighBp = isChallenge && brainPower >= 100;

  return (
    <div className="animate-badge-land flex gap-2 motion-reduce:animate-none">
      <Badge variant={isHighBp ? "default" : "secondary"}>
        <BrainIcon data-icon="inline-start" />
        <span>+{brainPower}</span> {t("BP")}
      </Badge>

      <Badge variant="secondary">
        <ZapIcon
          className={cn("text-energy", energyDelta < 0 && "text-destructive")}
          data-icon="inline-start"
        />
        <span className={cn(energyDelta < 0 && "text-destructive")}>
          {formatEnergyDelta(energyDelta)}
        </span>
        <span className="sr-only">{t("Energy")}</span>
      </Badge>
    </div>
  );
}

export function RewardBadgesSkeleton() {
  return (
    <div className="flex gap-2">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-5 w-16" />
    </div>
  );
}

const ANIMATION_START_DELAY = 50;
const LEVEL_UP_RESET_DELAY = 700;

function useBeltProgressAnimation({
  currentPercent,
  didLevelUp,
  levelUpUpdater,
  previousPercent,
}: {
  currentPercent: number;
  didLevelUp: boolean;
  levelUpUpdater: () => void;
  previousPercent: number;
}) {
  const [displayPercent, setDisplayPercent] = useState(previousPercent);
  const [skipTransition, setSkipTransition] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const frames: number[] = [];

    if (!didLevelUp) {
      timers.push(setTimeout(() => setDisplayPercent(currentPercent), ANIMATION_START_DELAY));
      return () => timers.forEach((timer) => clearTimeout(timer));
    }

    timers.push(setTimeout(() => setDisplayPercent(100), ANIMATION_START_DELAY));

    timers.push(
      setTimeout(() => {
        setSkipTransition(true);
        setDisplayPercent(0);
        levelUpUpdater();

        frames.push(
          requestAnimationFrame(() => {
            frames.push(
              requestAnimationFrame(() => {
                setSkipTransition(false);
                setDisplayPercent(currentPercent);
              }),
            );
          }),
        );
      }, LEVEL_UP_RESET_DELAY),
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      frames.forEach((frame) => cancelAnimationFrame(frame));
    };
    // Animation runs only on mount — values are captured in closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { displayPercent, skipTransition };
}

export function BeltProgressHint({
  brainPower,
  newTotalBp,
}: {
  brainPower: number;
  newTotalBp: number;
}) {
  const t = useExtracted();
  const { levelHref, LinkComponent } = usePlayer();
  const currentBelt = calculateBeltLevel(newTotalBp);
  const previousBelt = calculateBeltLevel(newTotalBp - brainPower);
  const didLevelUp =
    currentBelt.color !== previousBelt.color || currentBelt.level !== previousBelt.level;
  const currentColorLabel = useBeltColorLabel(currentBelt.color);
  const previousColorLabel = useBeltColorLabel(previousBelt.color);

  const currentPercent = getBeltProgressPercent(currentBelt);
  const previousPercent = getBeltProgressPercent(previousBelt);

  const [displayColor, setDisplayColor] = useState(
    didLevelUp ? previousBelt.color : currentBelt.color,
  );
  const [displayLabel, setDisplayLabel] = useState(
    didLevelUp ? previousColorLabel : currentColorLabel,
  );
  const [displayLevel, setDisplayLevel] = useState(
    didLevelUp ? previousBelt.level : currentBelt.level,
  );

  const { displayPercent, skipTransition } = useBeltProgressAnimation({
    currentPercent,
    didLevelUp,
    levelUpUpdater: () => {
      setDisplayColor(currentBelt.color);
      setDisplayLabel(currentColorLabel);
      setDisplayLevel(currentBelt.level);
    },
    previousPercent,
  });

  if (currentBelt.isMaxLevel || !levelHref) {
    return null;
  }

  return (
    <LinkComponent className="flex flex-col gap-1.5" href={levelHref}>
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
      <ProgressRoot aria-label={t("Level progress")} value={displayPercent}>
        <ProgressTrack className="h-1.5">
          <ProgressIndicator
            className={cn(
              beltColorClasses[displayColor],
              skipTransition ? "duration-0" : "duration-600 ease-out",
              "motion-reduce:duration-0",
            )}
          />
        </ProgressTrack>
      </ProgressRoot>
      <span className="text-muted-foreground text-xs tabular-nums">
        {t("{value} BP to level up", { value: String(currentBelt.bpToNextLevel) })}
      </span>
    </LinkComponent>
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
