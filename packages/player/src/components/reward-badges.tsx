"use client";

import { Badge } from "@zoonk/ui/components/badge";
import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { calculateBeltLevel } from "@zoonk/utils/belt-level";
import { BrainIcon, ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";
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
  const colorLabel = useBeltColorLabel(currentBelt.color);

  if (currentBelt.isMaxLevel || !levelHref) {
    return null;
  }

  if (didLevelUp) {
    return (
      <LinkComponent className="flex items-center gap-1.5" href={levelHref}>
        <BeltIndicator
          className="animate-dot-pulse motion-reduce:animate-none"
          color={currentBelt.color}
          label={colorLabel}
          size="sm"
        />
        <span className="text-foreground text-sm font-medium">
          {colorLabel} {t("Belt")} — {t("Level")} {currentBelt.level}
        </span>
      </LinkComponent>
    );
  }

  return (
    <LinkComponent className="flex items-center gap-1.5" href={levelHref}>
      <BeltIndicator color={currentBelt.color} label={colorLabel} size="sm" />
      <span className="text-muted-foreground text-xs">
        {currentBelt.bpToNextLevel} {t("BP to next level")}
      </span>
    </LinkComponent>
  );
}

export function BeltProgressSkeleton() {
  return (
    <div className="flex items-center gap-1.5">
      <Skeleton className="size-3 rounded-full" />
      <Skeleton className="h-3 w-28" />
    </div>
  );
}
