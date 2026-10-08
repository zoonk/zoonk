"use client";

import { setGoalStatusAction } from "@/app/[lang]/(learn)/_components/goal-status-action";
import { useRouter } from "@/i18n/navigation";
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
    <p className="text-destructive text-sm text-balance" role="alert">
      {outcome === "limitReached"
        ? t(
            "The free plan follows one goal at a time. Pause your other goal to resume this one, or get Plus for more.",
          )
        : t("We couldn't change this goal. Try again.")}
    </p>
  );
}

/** Resumes a paused goal: its plan starts again from today, and Today shows its day. */
export function ResumeGoalButton({ goalId }: { goalId: string }) {
  const t = useExtracted();
  const router = useRouter();
  const [outcome, setOutcome] = useState<GoalStatusOutcome | null>(null);
  const [isPending, startTransition] = useTransition();

  const resume = () => {
    startTransition(async () => {
      const result = await setGoalStatusAction(goalId, "active");
      setOutcome(result);

      if (result === "saved") {
        router.refresh();
      }
    });
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button disabled={isPending} onClick={resume}>
        {t("Resume")}
      </Button>
      <ResumeError outcome={outcome} />
    </div>
  );
}
