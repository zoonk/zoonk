"use client";

import { setGoalStatusAction } from "@/app/[lang]/(app)/(learn)/_components/goal-status-action";
import { type GoalStatusOutcome } from "@zoonk/learn/journey";
import { ChangeSaveError } from "@zoonk/learn/save-error";
import { Button } from "@zoonk/ui/components/button";
import { PlayIcon } from "lucide-react";
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
      {t({
        description:
          "Shown when a free learner tries to resume a paused goal while following as many goals as the free plan allows at once. “Following” a goal means it's active on the learner's plan: this counts goals followed at once, not new goals started per day or month. Pausing a goal keeps its progress. “Plus” is the name of the paid plan, not the word “more”.",
        message:
          "You're following as many goals as the free plan allows. Pause another goal to resume this one, or get Plus to follow more.",
      })}
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
      setOutcome(
        await setGoalStatusAction(goalId, "active").catch((): GoalStatusOutcome => "failed"),
      );
    });
  };

  return (
    <div className="flex min-w-0 flex-col items-stretch gap-2 sm:items-start">
      <Button
        busy={isPending}
        disabled={outcome === "saved"}
        focusableWhenDisabled
        icon={<PlayIcon aria-hidden="true" />}
        onClick={resume}
        size="lg"
      >
        <span className="truncate">{t("Resume {goal}", { goal: goalTitle })}</span>
      </Button>
      <ResumeError outcome={outcome} />
    </div>
  );
}
