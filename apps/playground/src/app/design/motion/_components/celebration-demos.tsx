"use client";

import { Burst } from "@zoonk/ui/components/burst";
import { CountUp } from "@zoonk/ui/components/count-up";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, StarIcon } from "lucide-react";
import { BeltTicks, LevelBadge, MissionsTrack, plus } from "./demo-parts";

const EARNED = 27;
const TILE_EARNED = 12;
const BONUS = 50;

const READOUT_CLASS = "text-readout text-[2.5rem]";

export function CountDemo() {
  return (
    <div className="flex flex-wrap items-end gap-10">
      <p className="flex items-baseline gap-2">
        <CountUp className={cn(READOUT_CLASS, "text-brain-text")} format={plus} value={EARNED} />
        <span className="text-muted-foreground text-sm font-medium">Brain Power</span>
      </p>

      <p className="ring-border rounded-option flex flex-col gap-1 px-4 py-3 ring-1">
        <span className="text-muted-foreground text-xs">Brain Power</span>
        <CountUp className="text-readout text-2xl" format={plus} value={TILE_EARNED} />
      </p>
    </div>
  );
}

export function SettleDemo() {
  return (
    <div className="flex flex-wrap items-center gap-10">
      <LevelBadge />

      <CheckIcon
        aria-hidden="true"
        className="text-success animate-settle size-5"
        strokeWidth={2.5}
      />

      <StarIcon aria-hidden="true" className="fill-success text-success animate-settle size-5" />
    </div>
  );
}

export function FillDemo() {
  return (
    <div className="flex max-w-xs flex-col gap-5">
      <BeltTicks />
      <MissionsTrack />
    </div>
  );
}

export function BurstDemo() {
  return (
    <span className="relative flex w-fit flex-col items-start gap-1 px-10 py-6">
      <span className={cn(READOUT_CLASS, "text-brain-text")}>{plus(BONUS)}</span>
      <span className="text-muted-foreground text-xs">Brain Power</span>
      <Burst className="text-brain top-10 left-16" />
    </span>
  );
}
