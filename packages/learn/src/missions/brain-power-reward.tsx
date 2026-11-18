"use client";

import { BrainPowerAmount } from "../_components/brain-power-amount";
import { LearnLink } from "../learn-link";

export function BrainPowerReward({ earned, points }: { earned: boolean; points: number }) {
  return (
    <LearnLink
      href="/level"
      className="hit-area focus-visible:ring-ring/50 relative flex items-center rounded-md text-xs outline-none focus-visible:ring-[3px]"
      data-slot="brain-power-reward"
    >
      <BrainPowerAmount earned={earned} explained points={points} />
    </LearnLink>
  );
}
