"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@zoonk/ui/components/tooltip";
import { useExtracted } from "next-intl";
import { BrainPowerAmount } from "../_components/brain-power-amount";
import { LearnLink } from "../learn-link";

/** The amount shows the unit's short form; hovering or focusing it names the unit in full. */
export function BrainPowerReward({ earned, points }: { earned: boolean; points: number }) {
  const t = useExtracted();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <LearnLink
            href="/level"
            className="hit-area focus-visible:ring-ring/50 relative flex items-center rounded-md text-xs outline-none focus-visible:ring-[3px]"
            data-slot="brain-power-reward"
          />
        }
      >
        <BrainPowerAmount earned={earned} points={points} />
      </TooltipTrigger>
      <TooltipContent>{t("Brain Power")}</TooltipContent>
    </Tooltip>
  );
}
