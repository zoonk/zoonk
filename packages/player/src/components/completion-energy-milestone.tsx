"use client";

import { formatMetricPercent, formatWholeNumber } from "@zoonk/utils/number";
import { ZapIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { type PlayerCompletionMilestone } from "../completion-milestones";
import { CompletionMilestoneMark, CompletionMilestoneTitle } from "./completion-milestone-shell";
import { PlayerSupportingText } from "./player-supporting-text";

type EnergyMilestone = Extract<PlayerCompletionMilestone, { kind: "energy" }>;

/** Marks Energy celebrations with the same restrained accent used across progress surfaces. */
export function EnergyMilestoneIndicator() {
  return (
    <CompletionMilestoneMark>
      <span className="bg-energy/10 text-energy flex size-10 items-center justify-center rounded-full">
        <ZapIcon aria-hidden className="size-5" />
      </span>
    </CompletionMilestoneMark>
  );
}

/** Keeps every threshold celebration pointed at the single 100% Energy goal. */
function EnergyThresholdCopy({
  milestone,
}: {
  milestone: Extract<EnergyMilestone, { status: "threshold" }>;
}) {
  const t = useExtracted();
  const format = useFormatter();

  if (milestone.energy === 100) {
    return (
      <>
        <CompletionMilestoneTitle>{t("Max Energy!")}</CompletionMilestoneTitle>
        <PlayerSupportingText>
          {t("Complete lessons every day and answer correctly to keep it full.")}
        </PlayerSupportingText>
      </>
    );
  }

  return (
    <>
      <CompletionMilestoneTitle>
        {t("{percentage} Energy", {
          percentage: formatMetricPercent({ format, value: milestone.energy }),
        })}
      </CompletionMilestoneTitle>
      <PlayerSupportingText>
        {t("Complete lessons every day and answer correctly to reach 100%.")}
      </PlayerSupportingText>
    </>
  );
}

/** Preserves the one-year celebration while naming other milestones by the familiar 100% goal. */
function FullEnergyDaysTitle({ days }: { days: number }) {
  const t = useExtracted();
  const format = useFormatter();
  const formattedDays = formatWholeNumber({ format, value: days });

  if (days === 365) {
    return <CompletionMilestoneTitle>{t("1 year of max Energy")}</CompletionMilestoneTitle>;
  }

  return (
    <CompletionMilestoneTitle>
      {t("{days} days at 100% Energy", { days: formattedDays })}
    </CompletionMilestoneTitle>
  );
}

/** Reinforces the daily action after a learner reaches a full-Energy milestone. */
function FullEnergyDaysCopy({
  milestone,
}: {
  milestone: Extract<EnergyMilestone, { status: "fullDays" }>;
}) {
  const t = useExtracted();

  return (
    <>
      <FullEnergyDaysTitle days={milestone.days} />
      <PlayerSupportingText>
        {t("Complete lessons every day and answer correctly to keep your Energy full.")}
      </PlayerSupportingText>
    </>
  );
}

/** Selects the matching copy while the milestone shell owns shared layout and actions. */
export function EnergyMilestoneCopy({ milestone }: { milestone: EnergyMilestone }) {
  if (milestone.status === "threshold") {
    return <EnergyThresholdCopy milestone={milestone} />;
  }

  return <FullEnergyDaysCopy milestone={milestone} />;
}
