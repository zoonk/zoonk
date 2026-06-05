"use client";

import { BeltIndicator } from "@zoonk/ui/components/belt-indicator";
import { type BeltColor } from "@zoonk/utils/belt-level";
import { useExtracted } from "next-intl";
import { type PlayerCompletionMilestone } from "../completion-milestones";
import { useBeltColorLabel } from "../use-belt-color-label";
import { CompletionMilestoneMark, CompletionMilestoneTitle } from "./completion-milestone-shell";
import { PlayerSupportingText } from "./player-supporting-text";

type LevelMilestone = Extract<PlayerCompletionMilestone, { kind: "level" }>;

function BeltMilestoneIndicator({ color, colorLabel }: { color: BeltColor; colorLabel: string }) {
  const t = useExtracted();

  return (
    <CompletionMilestoneMark>
      <BeltIndicator
        className="animate-dot-pulse size-8 motion-reduce:animate-none"
        color={color}
        label={t("{color} belt", { color: colorLabel })}
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
  const colorLabel = useBeltColorLabel(milestone.belt.color);

  return (
    <>
      <CompletionMilestoneTitle>{t("Level achieved")}</CompletionMilestoneTitle>
      <PlayerSupportingText>
        {t("You strengthened your mind and reached level {level} of the {color} belt. Congrats!", {
          color: colorLabel,
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
  const colorLabel = useBeltColorLabel(milestone.targetBelt.color);

  return (
    <>
      <CompletionMilestoneTitle>{t("Almost there")}</CompletionMilestoneTitle>
      <PlayerSupportingText>
        {t(
          "{count, plural, one {Your knowledge is growing. Complete # more lesson to reach level {level} of the {color} belt.} other {Your knowledge is growing. Complete # more lessons to reach level {level} of the {color} belt.}}",
          {
            color: colorLabel,
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
  const colorLabel = useBeltColorLabel(target.color);

  return <BeltMilestoneIndicator color={target.color} colorLabel={colorLabel} />;
}
