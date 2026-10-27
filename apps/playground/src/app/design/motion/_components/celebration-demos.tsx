"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { Burst } from "@zoonk/ui/components/burst";
import { CountUp } from "@zoonk/ui/components/count-up";
import { readDuration } from "@zoonk/ui/lib/motion";
import { cn } from "@zoonk/ui/lib/utils";
import { BrainIcon, CheckIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { BeltTicks, LevelBadge, MissionsTrack, plus } from "./demo-parts";

const EARNED = 27;
const TILE_EARNED = 12;
const BONUS = 50;

/** Enough Energy for a glad buddy, short of its glow. */
const BUDDY_ENERGY = 70;

/** When the reward lights up after the moment shows: its beat, once the numbers are in. */
const LIGHT_UP_MS = 400;

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

/**
 * Today's reward lighting up: from its violet words to a solid chip with a check, then a pop. With
 * reduced motion it's lit from the first frame.
 */
export function ChipDemo() {
  const chip = useRef<HTMLSpanElement>(null);
  const [lit, setLit] = useState(false);

  useLayoutEffect(() => {
    if (!chip.current || readDuration(chip.current, "pop") === 0) {
      setLit(true);
      return;
    }

    const timer = setTimeout(() => setLit(true), LIGHT_UP_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <span
      className={cn(
        "flex w-fit items-center gap-1 rounded-md py-1 pr-1.5 pl-1 font-mono text-base leading-none font-semibold tabular-nums transition-colors",
        lit ? "bg-brain text-background animate-pop" : "text-brain-text",
      )}
      ref={chip}
    >
      {lit ? (
        <CheckIcon aria-hidden="true" className="size-3.5" strokeWidth={3} />
      ) : (
        <BrainIcon aria-hidden="true" className="text-brain size-3.5" />
      )}
      {plus(BONUS)}
    </span>
  );
}

/** A new level's badge, a mission's check and a ceremony's art, each landing on the spring. */
export function SettleDemo() {
  return (
    <div className="flex flex-wrap items-center gap-10">
      <LevelBadge />

      <CheckIcon
        aria-hidden="true"
        className="text-success animate-settle size-5"
        strokeWidth={2.5}
      />

      <Buddy
        beltColor="orange"
        className="animate-settle size-24 [--settle-from:0.85]"
        energy={BUDDY_ENERGY}
        expression="cheer"
        kind="zu"
        studiedToday
      />
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

/** The buddy, glad, hopping once. */
export function BuddyDemo() {
  return (
    <span className="animate-hop flex w-fit">
      <Buddy
        beltColor="orange"
        className="size-24"
        energy={BUDDY_ENERGY}
        expression="cheer"
        kind="zu"
        studiedToday
      />
    </span>
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
