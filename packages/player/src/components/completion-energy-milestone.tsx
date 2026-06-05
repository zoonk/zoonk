"use client";

import { ZapIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
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

  if (milestone.energy === 100) {
    return (
      <>
        <CompletionMilestoneTitle>{t("Max Energy!")}</CompletionMilestoneTitle>
        <PlayerSupportingText>
          {t(
            "Congrats! You reached max Energy. Keep practicing every day to keep your Energy at 100%.",
          )}
        </PlayerSupportingText>
      </>
    );
  }

  return (
    <>
      <CompletionMilestoneTitle>
        {t("{energy}% Energy", { energy: String(milestone.energy) })}
      </CompletionMilestoneTitle>
      <PlayerSupportingText>
        {t("Your effort is paying off. Complete lessons every day to increase your Energy.")}
      </PlayerSupportingText>
    </>
  );
}

function FullEnergyDaysTitle({ days }: { days: number }) {
  const t = useExtracted();
  const locale = useLocale();
  const formattedDays = new Intl.NumberFormat(locale).format(days);

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
          "Wow, what incredible consistency! Keep studying every day to keep your Energy at 100%.",
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
