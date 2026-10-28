"use client";

import { CommandPalette } from "@/app/[lang]/(app)/(catalog)/_components/command-palette";
import {
  type LearnerPalette,
  UNREAD_LEARNER_PALETTE,
} from "@/app/[lang]/(app)/(catalog)/_components/command-palette-learner-groups";
import { switchGoal } from "@/app/[lang]/(app)/(learn)/_components/switch-goal";
import { hasSessionHint } from "@/lib/learner/session-hint";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { type LearnerSummary } from "@zoonk/core/learner/summary/contract";

function toLearnerPalette(summary: LearnerSummary): LearnerPalette {
  const active = summary.goals.find((goal) => goal.isActive);

  return {
    activeGoalId: summary.activeGoalId,
    buddy: { kind: summary.buddy.kind, name: summary.buddy.name },
    canAskBuddy: Boolean(active && active.kind !== "explain"),
    explanations: summary.goals
      .filter((goal) => goal.kind === "explain")
      .toReversed()
      .map(({ id, title }) => ({ id, title })),
    goals: summary.goals
      .filter((goal) => goal.kind !== "explain")
      .map(({ id, kind, title }) => ({ id, kind, title })),
    onSwitchGoal: switchGoal,
    places: summary.places,
    today: summary.today,
  };
}

export default function AppCommandPaletteDialog() {
  const learner = useLearnerSummary();

  if (learner.status === "ready") {
    return (
      <CommandPalette
        isLoggedIn={!learner.summary.identity.isAnonymous}
        learner={toLearnerPalette(learner.summary)}
      />
    );
  }

  if (learner.status !== "visitor" && hasSessionHint()) {
    return <CommandPalette isLoggedIn={false} learner={UNREAD_LEARNER_PALETTE} />;
  }

  return <CommandPalette isLoggedIn={false} />;
}
