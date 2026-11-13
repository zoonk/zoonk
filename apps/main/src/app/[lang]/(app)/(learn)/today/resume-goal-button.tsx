"use client";

import { setGoalStatusAction } from "@/app/[lang]/(app)/(learn)/_components/goal-status-action";
import { EnterButton } from "@zoonk/learn/enter-button";
import { type GoalStatusOutcome } from "@zoonk/learn/journey";
import { ChangeSaveError } from "@zoonk/learn/save-error";
import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";

type ResumeFailure = Exclude<GoalStatusOutcome, "saved">;

function ResumeError({ outcome }: { outcome: ResumeFailure }) {
  const t = useExtracted();

  if (outcome !== "limitReached") {
    return <ChangeSaveError />;
  }

  return (
    <p className="text-destructive-text text-sm text-pretty" role="alert">
      {t("That's as many goals as you can study at once. Pause another goal to resume this one.")}
    </p>
  );
}

/** A paused goal's bar: `children` (the other way on), then Resume. */
export function ResumeGoalBar({ children, goalId }: { children: React.ReactNode; goalId: string }) {
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
    <BottomBar note={outcome !== null && outcome !== "saved" && <ResumeError outcome={outcome} />}>
      <BottomBarActions>
        {children}
        <EnterButton busy={isPending} disabled={outcome === "saved"} onClick={resume}>
          {t("Resume")}
        </EnterButton>
      </BottomBarActions>
    </BottomBar>
  );
}
