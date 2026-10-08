"use client";

import { FlagIcon, SearchCheckIcon, TrophyIcon } from "lucide-react";
import { useExtracted, useFormatter } from "next-intl";
import { KindTile } from "../_components/kind-tile";
import { StepCard, StepRow, StepRows, StepTitle } from "../_components/step-card";
import { useCheckpointScreen } from "./checkpoint-context";
import { phaseNumber } from "./checkpoint-labels";

/** What a won checkpoint earned: the phase it checks off and the "Trap hunter" badge. */
function RewardRows() {
  const t = useExtracted();
  const { checkpoint } = useCheckpointScreen();
  const { reward } = checkpoint;
  const phase = phaseNumber(checkpoint);

  if (!reward.phaseComplete && !reward.badge) {
    return null;
  }

  return (
    <StepRows data-slot="checkpoint-rewards">
      {reward.phaseComplete && (
        <StepRow>
          <FlagIcon aria-hidden="true" className="text-muted-foreground" />
          <span className="font-medium">
            {phase ? t("Phase {phase} complete", { phase }) : t("Phase complete")}
          </span>
        </StepRow>
      )}
      {reward.badge && (
        <StepRow>
          <SearchCheckIcon aria-hidden="true" className="text-muted-foreground" />
          <span className="font-medium">{t("Trap hunter badge")}</span>
        </StepRow>
      )}
    </StepRows>
  );
}

/**
 * The rewards of a won checkpoint (or a finished weekly one): Brain Power big (what the duel
 * actually earned, answers included, right after it), then the phase and the badge.
 */
export function CheckpointRewardsStep() {
  const t = useExtracted();
  const format = useFormatter();
  const { checkpoint, duel } = useCheckpointScreen();
  const points = duel.state.completion?.brainPower ?? checkpoint.reward.brainPower;

  return (
    <StepCard>
      <KindTile
        className="motion-safe:animate-badge-land"
        icon={TrophyIcon}
        kind="challenge"
        size="lg"
      />
      <StepTitle>{t("+{points} Brain Power", { points: format.number(points) })}</StepTitle>
      <RewardRows />
    </StepCard>
  );
}
