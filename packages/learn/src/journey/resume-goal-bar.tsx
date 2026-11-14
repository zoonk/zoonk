"use client";

import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { useExtracted } from "next-intl";
import { useState, useTransition } from "react";
import { EnterButton } from "../_components/enter-button";
import { ChangeSaveError } from "../_components/save-error";
import { type GoalStatusOutcome } from "./goal-actions";

export function useGoalLimitText() {
  const t = useExtracted();
  return t("That's as many goals as you can study at once. Pause another goal to resume this one.");
}

function ResumeError({ outcome }: { outcome: Exclude<GoalStatusOutcome, "saved"> }) {
  const limitText = useGoalLimitText();

  if (outcome !== "limitReached") {
    return <ChangeSaveError />;
  }

  return (
    <p className="text-destructive-text text-sm text-pretty" role="alert">
      {limitText}
    </p>
  );
}

/**
 * A paused goal's bar: `children` (another way on), then Resume. Once `onResume` saves, the host
 * renders the goal again; the button stays busy until then.
 */
export function ResumeGoalBar({
  children,
  onResume,
}: {
  children?: React.ReactNode;
  onResume: () => Promise<GoalStatusOutcome>;
}) {
  const t = useExtracted();
  const [outcome, setOutcome] = useState<GoalStatusOutcome | null>(null);
  const [isPending, startTransition] = useTransition();

  const resume = () => {
    startTransition(async () => {
      setOutcome(await onResume().catch((): GoalStatusOutcome => "failed"));
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
