"use client";

import { Badge } from "@zoonk/ui/components/badge";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { BrainIcon, ZapIcon } from "lucide-react";
import { useExtracted } from "next-intl";

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
