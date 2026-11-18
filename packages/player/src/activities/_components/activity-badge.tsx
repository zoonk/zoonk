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
import { opensTitle } from "../_utils/badge-title";

export type ActivityBadgeKind =
  | "beforeAfter"
  | "dragCorner"
  | "earTraining"
  | "estimateFirst"
  | "moveLine"
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
  moveLine: ArrowLeftRight,
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
    estimateFirst: t({
      description:
        "A tag on an activity that asks for a guess: the guess is checked and scored like an answer, unlike a guess that doesn't count.",
      message: "Your guess counts",
    }),
    moveLine: t("Move a line"),
    predictFirst: t("Predict first"),
    stepByStep: t("Step by step"),
    stepThrough: t("Step through"),
    tapAlong: t("Tap along"),
    turnIt: t("Turn it"),
  };

  return labels[kind];
}

/** Chips that say what a question asks for first: a screen that only explores asks for nothing. */
const ASKS_FIRST: ReadonlySet<ActivityBadgeKind> = new Set(["estimateFirst", "predictFirst"]);

export function isExploreBadge(kind: ActivityBadgeKind): boolean {
  return !ASKS_FIRST.has(kind);
}

/** `over` is the lines the chip sits over: a chip that only repeats how one of them opens is dropped. */
export function ActivityBadge({
  kind,
  over,
}: {
  kind: ActivityBadgeKind;
  over: readonly string[];
}) {
  const Icon = BADGE_ICONS[kind];
  const label = useBadgeLabel(kind);

  if (over.some((title) => opensTitle({ label, title }))) {
    return null;
  }

  return (
    <Eyebrow data-slot="activity-badge" icon={<Icon aria-hidden="true" />}>
      {label}
    </Eyebrow>
  );
}
