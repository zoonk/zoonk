"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type PlayerCompletionMilestone } from "../completion-milestones";
import { type PlayerRoute } from "../player-context";
import { PlayerLink } from "../player-link";
import {
  BrainPowerMilestoneCopy,
  BrainPowerMilestoneIndicator,
} from "./completion-brain-power-milestone";
import { EnergyMilestoneCopy, EnergyMilestoneIndicator } from "./completion-energy-milestone";
import { LevelMilestoneCopy, LevelMilestoneIndicator } from "./completion-level-milestone";
import {
  CompletionMilestoneActions,
  CompletionMilestoneContinueButton,
  CompletionMilestoneCopy,
  CompletionMilestoneScreen,
} from "./completion-milestone-shell";

/**
 * Routes each milestone kind to the copy that explains the specific progress
 * signal instead of forcing unrelated conditions into one paragraph.
 */
function CompletionMilestoneCopyContent({ milestone }: { milestone: PlayerCompletionMilestone }) {
  if (milestone.kind === "level") {
    return <LevelMilestoneCopy milestone={milestone} />;
  }

  if (milestone.kind === "energy") {
    return <EnergyMilestoneCopy milestone={milestone} />;
  }

  return <BrainPowerMilestoneCopy milestone={milestone} />;
}

/**
 * Renders the visual mark that matches the milestone's progress metric.
 */
function CompletionMilestoneIndicator({ milestone }: { milestone: PlayerCompletionMilestone }) {
  if (milestone.kind === "level") {
    return <LevelMilestoneIndicator milestone={milestone} />;
  }

  if (milestone.kind === "energy") {
    return <EnergyMilestoneIndicator />;
  }

  return <BrainPowerMilestoneIndicator />;
}

/**
 * Chooses the relevant progress page for the secondary learning link. Energy
 * milestones should teach Energy, while level and BP milestones teach levels.
 */
function getMilestoneHref({
  energyHref,
  levelHref,
  milestone,
}: {
  energyHref?: PlayerRoute;
  levelHref?: PlayerRoute;
  milestone: PlayerCompletionMilestone;
}) {
  if (milestone.kind === "energy") {
    return energyHref;
  }

  return levelHref;
}

/**
 * Labels the secondary link with the metric-specific page it opens.
 */
function CompletionMilestoneLearnLink({
  energyHref,
  levelHref,
  milestone,
}: {
  energyHref?: PlayerRoute;
  levelHref?: PlayerRoute;
  milestone: PlayerCompletionMilestone;
}) {
  const t = useExtracted();
  const href = getMilestoneHref({ energyHref, levelHref, milestone });

  if (!href) {
    return null;
  }

  const label = milestone.kind === "energy" ? t("Learn about Energy") : t("Learn about levels");

  return (
    <PlayerLink className={cn(buttonVariants({ variant: "outline" }), "w-full")} href={href}>
      {label}
    </PlayerLink>
  );
}

/**
 * Renders the dedicated progress milestone screen shown before the regular
 * completion summary when a completion crosses a meaningful progress boundary.
 */
export function CompletionProgressMilestoneScreen({
  energyHref,
  levelHref,
  milestone,
  onContinue,
}: {
  energyHref?: PlayerRoute;
  levelHref?: PlayerRoute;
  milestone: PlayerCompletionMilestone;
  onContinue: () => void;
}) {
  const t = useExtracted();

  return (
    <CompletionMilestoneScreen>
      <CompletionMilestoneIndicator milestone={milestone} />

      <CompletionMilestoneCopy>
        <CompletionMilestoneCopyContent milestone={milestone} />
      </CompletionMilestoneCopy>

      <CompletionMilestoneActions>
        <CompletionMilestoneContinueButton onContinue={onContinue}>
          {t("Continue")}
        </CompletionMilestoneContinueButton>

        <CompletionMilestoneLearnLink
          energyHref={energyHref}
          levelHref={levelHref}
          milestone={milestone}
        />
      </CompletionMilestoneActions>
    </CompletionMilestoneScreen>
  );
}
