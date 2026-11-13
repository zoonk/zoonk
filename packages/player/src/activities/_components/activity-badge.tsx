"use client";

import { Eyebrow } from "@zoonk/learn/eyebrow";
import {
  ArrowLeftRight,
  Dices,
  Ear,
  Footprints,
  GitCompareArrows,
  Hand,
  ListOrdered,
  type LucideIcon,
  Move,
  RotateCw,
  Target,
} from "lucide-react";
import { useExtracted } from "next-intl";

export type ActivityBadgeKind =
  | "beforeAfter"
  | "dragCorner"
  | "earTraining"
  | "estimateFirst"
  | "moveCurve"
  | "predictFirst"
  | "stepByStep"
  | "stepThrough"
  | "tapAlong"
  | "turnIt";

const BADGE_ICONS: Record<ActivityBadgeKind, LucideIcon> = {
  beforeAfter: GitCompareArrows,
  dragCorner: Move,
  earTraining: Ear,
  estimateFirst: Target,
  moveCurve: ArrowLeftRight,
  predictFirst: Dices,
  stepByStep: ListOrdered,
  stepThrough: Footprints,
  tapAlong: Hand,
  turnIt: RotateCw,
};

function useBadgeLabel(kind: ActivityBadgeKind): string {
  const t = useExtracted();

  const labels: Record<ActivityBadgeKind, string> = {
    beforeAfter: t("Before and after"),
    dragCorner: t("Drag a corner"),
    earTraining: t("Ear training"),
    estimateFirst: t("Estimate first"),
    moveCurve: t("Move a curve"),
    predictFirst: t("Predict first"),
    stepByStep: t("Step by step"),
    stepThrough: t("Step through"),
    tapAlong: t("Tap along"),
    turnIt: t("Turn it"),
  };

  return labels[kind];
}

export function ActivityBadge({ kind }: { kind: ActivityBadgeKind }) {
  const Icon = BADGE_ICONS[kind];
  const label = useBadgeLabel(kind);

  return (
    <Eyebrow data-slot="activity-badge" icon={<Icon aria-hidden="true" />}>
      {label}
    </Eyebrow>
  );
}
