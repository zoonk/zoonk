"use client";

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { BrainIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { BrainPowerAmount } from "../_components/brain-power-amount";
import { renderSentenceNumber } from "./mission-copy";

export function BrainPowerReward({
  brainPower,
  earned,
  points,
}: {
  brainPower: number | null;
  earned: boolean;
  points: number;
}) {
  const t = useExtracted();
  const format = useFormatter();

  return (
    <Popover>
      {/* Under its title when the row wraps, so it starts on the row's start edge there. */}
      <PopoverTrigger
        className="hit-area focus-visible:ring-ring/50 relative rounded-md text-xs outline-none focus-visible:ring-[3px]"
        data-slot="brain-power-reward"
      >
        <BrainPowerAmount earned={earned} explained points={points} />
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 gap-2">
        <PopoverHeader>
          <PopoverTitle>{t("Brain Power")}</PopoverTitle>
          <PopoverDescription>
            {t("Points for what you learn. They raise your belt and grow your buddy.")}
          </PopoverDescription>
        </PopoverHeader>

        {brainPower !== null && (
          <p className="flex items-center gap-1.5 text-sm">
            <BrainIcon aria-hidden="true" className="text-brain size-4" />
            {t.rich("You have <mono>{points}</mono>", {
              mono: renderSentenceNumber,
              points: format.number(brainPower),
            })}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
