"use client";

import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { useExtracted } from "next-intl";
import { type PlayerCompletionMilestone } from "../completion-milestones";
import { useBeltLabel } from "../use-belt-label";
import { CompletionMilestoneMark, CompletionMilestoneTitle } from "./completion-milestone-shell";
import { PlayerSupportingText } from "./player-supporting-text";

type LevelMilestone = Extract<PlayerCompletionMilestone, { kind: "level" }>;

function BeltMilestoneIndicator({ color, label }: { color: BeltColor; label: string }) {
  return (
    <CompletionMilestoneMark>
      <BeltIndicator
        className="animate-dot-pulse size-8 motion-reduce:animate-none"
        color={color}
        label={label}
        size="lg"
      />
    </CompletionMilestoneMark>
  );
}

function AchievedLevelCopy({
  milestone,
}: {
  milestone: Extract<LevelMilestone, { status: "achieved" }>;
}) {
  const t = useExtracted();
  const beltLabel = useBeltLabel(milestone.belt.color);

  return (
    <>
      <CompletionMilestoneTitle>{t("Level achieved")}</CompletionMilestoneTitle>
      <PlayerSupportingText>
        {t("You reached a new level: {belt}, level {level}. Congrats!", {
          belt: beltLabel,
          level: String(milestone.belt.level),
        })}
      </PlayerSupportingText>
    </>
  );
}

function HalfwayLevelCopy({
  milestone,
}: {
  milestone: Extract<LevelMilestone, { status: "halfway" }>;
}) {
  const t = useExtracted();
  const beltLabel = useBeltLabel(milestone.targetBelt.color);

  return (
    <>
      <CompletionMilestoneTitle>{t("Almost there")}</CompletionMilestoneTitle>
      <PlayerSupportingText>
        {t(
          "Your knowledge is growing. Complete {count, plural, one {# more lesson} other {# more lessons}} to reach {belt}, level {level}.",
          {
            belt: beltLabel,
            count: milestone.remainingLessons,
            level: String(milestone.targetBelt.level),
          },
        )}
      </PlayerSupportingText>
    </>
  );
}

export function LevelMilestoneCopy({ milestone }: { milestone: LevelMilestone }) {
  if (milestone.status === "achieved") {
    return <AchievedLevelCopy milestone={milestone} />;
  }

  return <HalfwayLevelCopy milestone={milestone} />;
}

function getLevelMilestoneTarget(milestone: LevelMilestone) {
  if (milestone.status === "achieved") {
    return milestone.belt;
  }

  return milestone.targetBelt;
}

export function LevelMilestoneIndicator({ milestone }: { milestone: LevelMilestone }) {
  const target = getLevelMilestoneTarget(milestone);
  const beltLabel = useBeltLabel(target.color);

  return <BeltMilestoneIndicator color={target.color} label={beltLabel} />;
}
