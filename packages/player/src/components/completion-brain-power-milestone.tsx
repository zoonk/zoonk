"use client";

import { BrainIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { type PlayerCompletionMilestone } from "../completion-milestones";
import { CompletionMilestoneMark, CompletionMilestoneTitle } from "./completion-milestone-shell";
import { PlayerSupportingText } from "./player-supporting-text";

type BrainPowerMilestone = Extract<PlayerCompletionMilestone, { kind: "brainPower" }>;

export function BrainPowerMilestoneIndicator() {
  return (
    <CompletionMilestoneMark>
      <span className="bg-score/10 text-score flex size-10 items-center justify-center rounded-full">
        <BrainIcon aria-hidden className="size-5" />
      </span>
    </CompletionMilestoneMark>
  );
}

export function BrainPowerMilestoneCopy({ milestone }: { milestone: BrainPowerMilestone }) {
  const t = useExtracted();
  const locale = useLocale();
  const formattedBrainPower = new Intl.NumberFormat(locale).format(milestone.brainPower);

  return (
    <>
      <CompletionMilestoneTitle>{t("Daily record")}</CompletionMilestoneTitle>
      <PlayerSupportingText>
        {t(
          "You have never learned as much as you did today. Your Brain Power increased by {brainPower} BP. Congrats!",
          { brainPower: formattedBrainPower },
        )}
      </PlayerSupportingText>
    </>
  );
}
