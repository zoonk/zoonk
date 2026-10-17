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
import { renderMono } from "./mission-copy";

/**
 * The day's reward, "+50 Brain Power", in its own violet: what the missions are for. It lights up
 * as a solid chip once earned. A tap says what Brain Power is and how much the learner has.
 */
export function BrainPowerReward({
  brainPower,
  earned,
  points,
}: {
  /** The learner's Brain Power so far; null where it isn't known. */
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
        className="hit-area focus-visible:ring-ring/50 relative flex shrink-0 flex-col items-end gap-1 rounded-md outline-none focus-visible:ring-[3px]"
        data-slot="brain-power-reward"
      >
        <span
          className={cn(
            "flex items-center gap-1 font-mono text-base leading-none font-semibold tabular-nums",
            earned ? "bg-brain text-background rounded-md py-1 pr-1.5 pl-1" : "text-brain-text",
          )}
        >
          {earned ? (
            <CheckIcon aria-hidden="true" className="size-3.5" strokeWidth={3} />
          ) : (
            <BrainIcon aria-hidden="true" className="text-brain size-3.5" />
          )}
          {value}
        </span>
        <span className="text-muted-foreground decoration-faint text-[0.6875rem] leading-none underline decoration-dotted underline-offset-2">
          {t("Brain Power")}
        </span>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-64 gap-2">
        <PopoverHeader>
          <PopoverTitle>{t("Brain Power")}</PopoverTitle>
          <PopoverDescription>
            {t(
              "What you've learned, in points: it raises your belt and grows your buddy. Answers, lessons and challenges add to it, and finishing today's missions adds +{points}.",
              { points: format.number(points) },
            )}
          </PopoverDescription>
        </PopoverHeader>

        {brainPower !== null && (
          <p className="flex items-center gap-1.5 text-sm">
            <BrainIcon aria-hidden="true" className="text-brain size-4" />
            {t.rich("You have <mono>{points}</mono>", {
              mono: renderMono,
              points: format.number(brainPower),
            })}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
