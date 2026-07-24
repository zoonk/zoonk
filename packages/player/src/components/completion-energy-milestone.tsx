"use client";

import { formatMetricPercent, formatWholeNumber } from "@zoonk/utils/number";
import { ZapIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { type PlayerCompletionMilestone } from "../completion-milestones";
import { CompletionMilestoneMark, CompletionMilestoneTitle } from "./completion-milestone-shell";
import { PlayerSupportingText } from "./player-supporting-text";

type EnergyMilestone = Extract<PlayerCompletionMilestone, { kind: "energy" }>;

export function EnergyMilestoneIndicator() {
  return (
    <CompletionMilestoneMark>
      <span className="bg-energy/10 text-energy flex size-10 items-center justify-center rounded-full">
        <ZapIcon aria-hidden className="size-5" />
      </span>
    </CompletionMilestoneMark>
  );
}

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
          {t(
            "You've been learning regularly and answering accurately. Stay consistent to keep your Energy at 100%.",
          )}
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
        {t(
          "You're building good momentum. Learning regularly and getting answers right will keep your Energy moving up.",
        )}
      </PlayerSupportingText>
    </>
  );
}

function FullEnergyDaysTitle({ days }: { days: number }) {
  const t = useExtracted();
  const format = useFormatter();
  const formattedDays = formatWholeNumber({ format, value: days });

  if (days === 365) {
    return <CompletionMilestoneTitle>{t("1 year of max Energy")}</CompletionMilestoneTitle>;
  }

  return (
    <CompletionMilestoneTitle>
      {t("{days} days of max Energy", { days: formattedDays })}
    </CompletionMilestoneTitle>
  );
}

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
        {t(
          "You're building real consistency. Learning every day helps keep your mind active and improve your performance.",
        )}
      </PlayerSupportingText>
    </>
  );
}

export function EnergyMilestoneCopy({ milestone }: { milestone: EnergyMilestone }) {
  if (milestone.status === "threshold") {
    return <EnergyThresholdCopy milestone={milestone} />;
  }

  return <FullEnergyDaysCopy milestone={milestone} />;
}
