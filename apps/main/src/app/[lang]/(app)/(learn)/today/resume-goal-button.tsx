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
    <p className="text-destructive-text text-sm text-pretty" role="alert">
      {t(
        "That's as many goals as you can study at once without Plus. Pause another goal to resume this one.",
      )}
    </p>
  );
}

export function ResumeGoalButton({ goalId }: { goalId: string }) {
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
      <form action={() => resume()} className="contents">
        <Button
          busy={isPending}
          disabled={outcome === "saved"}
          focusableWhenDisabled
          icon={<PlayIcon aria-hidden="true" />}
          size="lg"
          type="submit"
        >
          {t("Resume")}
        </Button>
      </form>
      <ResumeError outcome={outcome} />
    </div>
  );
}
