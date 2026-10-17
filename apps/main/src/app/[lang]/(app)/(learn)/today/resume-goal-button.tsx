"use client";

import { setGoalStatusAction } from "@/app/[lang]/(app)/(learn)/_components/goal-status-action";
import { withLearnerWrite } from "@/lib/learner/learner-views";
import { type GoalStatusOutcome } from "@zoonk/learn/journey";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";

/** Why resuming didn't go through, said under the button. */
function ResumeError({ outcome }: { outcome: GoalStatusOutcome | null }) {
  const t = useExtracted();

  if (outcome === null || outcome === "saved") {
    return null;
  }

  return (
    <p className="text-destructive-text text-sm text-balance" role="alert">
      {outcome === "limitReached"
        ? t(
            "The free plan follows one goal at a time. Pause your other goal to resume this one, or get Plus for more.",
          )
        : t("We couldn't change this goal. Try again.")}
    </p>
  );
}

/** Resumes a paused goal: its plan starts again from today, and Today shows its day. */
export function ResumeGoalButton({ goalId, goalTitle }: { goalId: string; goalTitle: string }) {
  const t = useExtracted();
  const [outcome, setOutcome] = useState<GoalStatusOutcome | null>(null);
  const [isPending, startTransition] = useTransition();

  // Saved, the resume is a learner write: Today here reads itself again from it (its state sync),
  // once, and so do the learner's other tabs. The button stays busy until the day replaces it.
  const resume = () => {
    startTransition(async () => {
      const result = await withLearnerWrite(
        () => setGoalStatusAction(goalId, "active"),
        (status) => status === "saved",
      );

      setOutcome(result);
    });
  };

  return (
    <div className="flex min-w-0 flex-col items-stretch gap-2 sm:items-start">
      <Button
        disabled={isPending || outcome === "saved"}
        focusableWhenDisabled
        onClick={resume}
        size="lg"
      >
        <span className="truncate">{t("Resume {goal}", { goal: goalTitle })}</span>
      </Button>
      <ResumeError outcome={outcome} />
    </div>
  );
}
