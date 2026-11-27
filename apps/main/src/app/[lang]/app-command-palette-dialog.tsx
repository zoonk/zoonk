"use client";

import { CommandPalette } from "@/app/[lang]/(app)/(catalog)/_components/command-palette";
import {
  type LearnerPalette,
  UNREAD_LEARNER_PALETTE,
} from "@/app/[lang]/(app)/(catalog)/_components/command-palette-learner-groups";
import { switchGoal } from "@/app/[lang]/(app)/(learn)/_components/switch-goal";
import { hasSessionHint } from "@/lib/learner/session-hint";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { useListedPlaces } from "@/lib/saved-lessons/saved-lessons-place";
import {
  type LearnerSummary,
  type LearnerSummaryPlaces,
} from "@zoonk/core/learner/summary/contract";

function toLearnerPalette(summary: LearnerSummary, places: LearnerSummaryPlaces): LearnerPalette {
  const active = summary.goals.find((goal) => goal.isActive);

  return {
    activeGoalId: summary.activeGoalId,
    buddy: summary.buddy,
    canAskBuddy: Boolean(active && active.kind !== "explain"),
    explanations: summary.goals
      .filter((goal) => goal.kind === "explain")
      .toReversed()
      .map(({ id, title }) => ({ id, title })),
    goals: summary.goals
      .filter((goal) => goal.kind !== "explain")
      .map(({ id, kind, title, displayName }) => ({ displayName, id, kind, title })),
    onSwitchGoal: switchGoal,
    places,
    today: summary.today,
  };
}

function ReadyCommandPalette({ summary }: { summary: LearnerSummary }) {
  const places = useListedPlaces(summary.places);

  return (
    <CommandPalette
      isLoggedIn={!summary.identity.isAnonymous}
      learner={toLearnerPalette(summary, places)}
    />
  );
}

export default function AppCommandPaletteDialog() {
  const learner = useLearnerSummary();

  if (learner.status === "ready") {
    return <ReadyCommandPalette summary={learner.summary} />;
  }

  if (learner.status !== "visitor" && hasSessionHint()) {
    return <CommandPalette isLoggedIn={false} learner={UNREAD_LEARNER_PALETTE} />;
  }

  return <CommandPalette isLoggedIn={false} />;
}
