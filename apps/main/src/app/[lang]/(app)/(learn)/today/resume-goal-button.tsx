"use client";

import { setGoalStatusAction } from "@/app/[lang]/(app)/(learn)/_components/goal-status-action";
import { type GoalStatusOutcome } from "@zoonk/learn/journey";
import { ChangeSaveError } from "@zoonk/learn/save-error";
import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";

function ResumeError({ outcome }: { outcome: GoalStatusOutcome | null }) {
  const t = useExtracted();

  if (outcome === null || outcome === "saved") {
    return null;
  }

  if (outcome !== "limitReached") {
    return <ChangeSaveError />;
  }

  return (
    <p className="text-destructive-text text-sm text-balance" role="alert">
      {t(
        "The free plan follows one goal at a time. Pause your other goal to resume this one, or get Plus for more.",
      )}
    </p>
  );
}

export function ResumeGoalButton({ goalId, goalTitle }: { goalId: string; goalTitle: string }) {
  const t = useExtracted();
  const [outcome, setOutcome] = useState<GoalStatusOutcome | null>(null);
  const [isPending, startTransition] = useTransition();

  // The resume expires the learner's goals, so Today renders again; the button stays busy until then.
  const resume = () => {
    startTransition(async () => {
      setOutcome(await setGoalStatusAction(goalId, "active"));
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
