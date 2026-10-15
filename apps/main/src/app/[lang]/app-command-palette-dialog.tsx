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

/**
 * The learner's palette: their goals (switched as the goal switcher switches them) and quick
 * explanations (newest first: an explanation has no plan for the tabs to show, and one read to the
 * end is found again here), their places, today's next block and their buddy, who tutors the
 * active goal unless it's a quick explanation, as its tab does.
 */
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

/**
 * The palette itself, loaded on the first request: a learner's or a guest's with their actions,
 * places and other goals (the places every learner has until they're read); the public pages' for
 * a visitor.
 */
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
