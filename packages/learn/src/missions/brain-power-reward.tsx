"use client";

import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { cn } from "@zoonk/ui/lib/utils";
import { BrainIcon, CheckIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
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
  const value = `+${format.number(points)}`;

  return (
    <Popover>
      <PopoverTrigger
        className="hit-area focus-visible:ring-ring/50 relative ms-auto flex flex-wrap items-center justify-end gap-x-1.5 rounded-md outline-none focus-visible:ring-[3px]"
        data-slot="brain-power-reward"
      >
        {/* Earned, the chip is `brain-text`: the page's color on `brain` is under AA in light. */}
        <span
          className={cn(
            "flex items-center gap-1 font-mono text-sm font-semibold tabular-nums",
            earned
              ? "bg-brain-text text-background rounded-sm py-1 pr-1.5 pl-1 leading-none"
              : "text-brain-text leading-snug",
          )}
        >
          {earned ? (
            <CheckIcon aria-hidden="true" className="size-3" strokeWidth={3} />
          ) : (
            <BrainIcon aria-hidden="true" className="text-brain size-3.5" />
          )}
          {value}
        </span>
        <span className="text-muted-foreground decoration-faint text-xs leading-snug underline decoration-dotted underline-offset-2">
          {t("Brain Power")}
        </span>
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
