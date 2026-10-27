"use client";

import { Burst } from "@zoonk/ui/components/burst";
import { CountUp } from "@zoonk/ui/components/count-up";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, StarIcon } from "lucide-react";
import { BeltTicks, LevelBadge, MissionsTrack, plus } from "./demo-parts";

const EARNED = 27;
const TILE_EARNED = 12;
const BONUS = 50;

/** A readout's number, as a task's end draws it. */
const READOUT_CLASS = "text-readout text-[2.5rem]";

/** Brain Power counting up as a task's end draws it, and as a result's tile does. */
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

/** A new level's badge, a mission's check and a call's star, each landing on the spring. */
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

/** A belt's new tick filling from empty, and the mission just done filling its part of the track. */
export function FillDemo() {
  return (
    <div className="flex max-w-xs flex-col gap-5">
      <BeltTicks />
      <MissionsTrack />
    </div>
  );
}

/** Today's bonus in violet, bursting once. */
export function BurstDemo() {
  return (
    <span className="relative flex w-fit flex-col items-start gap-1 px-10 py-6">
      <span className={cn(READOUT_CLASS, "text-brain-text")}>{plus(BONUS)}</span>
      <span className="text-muted-foreground text-xs">Brain Power</span>
      <Burst className="text-brain top-10 left-16" />
    </span>
  );
}
