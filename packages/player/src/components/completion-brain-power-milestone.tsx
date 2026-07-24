"use client";

import { formatWholeNumber } from "@zoonk/utils/number";
import { BrainIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
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
  const format = useFormatter();
  const formattedBrainPower = formatWholeNumber({ format, value: milestone.brainPower });

  return (
    <>
      <CompletionMilestoneTitle>{t("New daily best")}</CompletionMilestoneTitle>
      <PlayerSupportingText>
        {t(
          "You earned {brainPower} BP today, more than on any other day. Keep it up—this effort will pay off.",
          { brainPower: formattedBrainPower },
        )}
      </PlayerSupportingText>
    </>
  );
}
