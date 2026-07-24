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
import {
  LearningDaysMilestoneCopy,
  LearningDaysMilestoneIndicator,
} from "./completion-learning-days-milestone";
import {
  LearningTimeMilestoneCopy,
  LearningTimeMilestoneIndicator,
} from "./completion-learning-time-milestone";
import { LevelMilestoneCopy, LevelMilestoneIndicator } from "./completion-level-milestone";
import {
  CompletionMilestoneActions,
  CompletionMilestoneContinueButton,
  CompletionMilestoneCopy,
  CompletionMilestoneScreen,
} from "./completion-milestone-shell";
import { PatternsMilestoneCopy, PatternsMilestoneIndicator } from "./completion-patterns-milestone";

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

  if (milestone.kind === "learningDays") {
    return <LearningDaysMilestoneCopy milestone={milestone} />;
  }

  if (milestone.kind === "learningTime") {
    return <LearningTimeMilestoneCopy milestone={milestone} />;
  }

  if (milestone.kind === "patterns") {
    return <PatternsMilestoneCopy milestone={milestone} />;
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

  if (milestone.kind === "learningDays") {
    return <LearningDaysMilestoneIndicator />;
  }

  if (milestone.kind === "learningTime") {
    return <LearningTimeMilestoneIndicator />;
  }

  if (milestone.kind === "patterns") {
    return <PatternsMilestoneIndicator />;
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
  patternsHref,
}: {
  energyHref?: PlayerRoute;
  levelHref?: PlayerRoute;
  milestone: PlayerCompletionMilestone;
  patternsHref?: PlayerRoute;
}) {
  if (milestone.kind === "energy") {
    return energyHref;
  }

  if (milestone.kind === "patterns") {
    return patternsHref;
  }

  return levelHref;
}

/**
 * Labels the secondary link with the metric-specific page it opens.
 */
function CompletionMilestoneLinkLabel({ milestone }: { milestone: PlayerCompletionMilestone }) {
  const t = useExtracted();

  if (milestone.kind === "energy") {
    return <>{t("Learn about Energy")}</>;
  }

  if (milestone.kind === "patterns") {
    return <>{t("See your patterns")}</>;
  }

  return <>{t("Learn about levels")}</>;
}

/**
 * Renders the optional secondary link without coupling the shared player
 * package to concrete app routes.
 */
function CompletionMilestoneLearnLink({
  energyHref,
  levelHref,
  milestone,
  patternsHref,
}: {
  energyHref?: PlayerRoute;
  levelHref?: PlayerRoute;
  milestone: PlayerCompletionMilestone;
  patternsHref?: PlayerRoute;
}) {
  const href = getMilestoneHref({ energyHref, levelHref, milestone, patternsHref });

  if (!href) {
    return null;
  }

  return (
    <PlayerLink className={cn(buttonVariants({ variant: "outline" }), "w-full")} href={href}>
      <CompletionMilestoneLinkLabel milestone={milestone} />
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
  patternsHref,
}: {
  energyHref?: PlayerRoute;
  levelHref?: PlayerRoute;
  milestone: PlayerCompletionMilestone;
  onContinue: () => void;
  patternsHref?: PlayerRoute;
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
          patternsHref={patternsHref}
        />
      </CompletionMilestoneActions>
    </CompletionMilestoneScreen>
  );
}
