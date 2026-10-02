"use client";

import { type MapSkill } from "@zoonk/core/view-models/map/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheckIcon, CircleDotIcon, CircleIcon, StarIcon } from "lucide-react";

/**
 * Each state keeps a shape as well as a color, so the map reads without color: an empty ring for
 * New, a dot for Learning, a check for Solid and a star for Mastered (gold in Fun).
 */
const STATE_ICONS = {
  learning: CircleDotIcon,
  mastered: StarIcon,
  new: CircleIcon,
  solid: CircleCheckIcon,
} as const;

type MasteryState = MapSkill["state"];

const STATE_ICON_TONES: Record<MasteryState, string> = {
  learning: "text-info",
  mastered: "fill-current text-success in-data-[mode=fun]:text-fun-accent-amber",
  new: "text-muted-foreground",
  solid: "text-foreground",
};

/** A node's tint over the card, from the same tokens in both modes. */
export const STATE_SURFACES: Record<MasteryState, string> = {
  learning: "bg-info/10",
  mastered: "bg-success/10 in-data-[mode=fun]:bg-fun-accent-amber/15",
  new: "bg-transparent",
  solid: "bg-foreground/5",
};

export function SkillStateIcon({ className, state }: { className?: string; state: MasteryState }) {
  const Icon = STATE_ICONS[state];

  return (
    <Icon
      aria-hidden="true"
      className={cn("size-4 shrink-0", STATE_ICON_TONES[state], className)}
    />
  );
}

/** Fading skills wear a dashed amber outline until a review relights them. */
export const FADING_OUTLINE = "border-dashed border-warning";
