"use client";

import { Button } from "@zoonk/ui/components/button";
import { useExtracted } from "next-intl";
import { SavePlanNote } from "../../onboarding/save-plan-note";
import { TaskMainButton } from "../../shell/task-frame";
import { ExtraTimeButton } from "../extra-time-button";
import { useSessionAction } from "../use-session-action";
import { useIsStopped, useSessionSummary } from "./summary-context";

function ActionFailed({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-destructive text-center text-sm" role="alert">
      {children}
    </p>
  );
}

/** The last step's main action, back to Today. Enter presses it. */
export function FinishButton() {
  const t = useExtracted();
  const { actions } = useSessionSummary();
  const { failed, isPending, run } = useSessionAction({ action: actions.done });

  return (
    <div className="flex flex-col gap-2">
      {failed && <ActionFailed>{t("That didn't go through. Try again in a moment.")}</ActionFailed>}
      <TaskMainButton busy={isPending} onClick={run}>
        {t("Finish")}
      </TaskMainButton>
    </div>
  );
}

/** Right after stopping for today, the rest of the session is one tap away. */
function KeepGoingButton() {
  const t = useExtracted();
  const { actions } = useSessionSummary();
  const { failed, isPending, run } = useSessionAction({ action: actions.keepGoing });

  return (
    <>
      <Button className="w-full" disabled={isPending} onClick={run} size="lg" variant="ghost">
        {t("Keep going")}
      </Button>

      {failed && <ActionFailed>{t("We couldn't open the next step. Try again.")}</ActionFailed>}
    </>
  );
}

/**
 * Under Finish: after the day's session, "10 more minutes" while there's something left to study
 * (capped, and never past a guardian's limit); right after stopping for today, "Keep going". A
 * guest is asked, softly, to save their plan.
 */
export function SummaryOptions() {
  const stopped = useIsStopped();
  const { actions, signUpHref, summary } = useSessionSummary();
  const { extraTime } = summary;

  return (
    <>
      {stopped && <KeepGoingButton />}

      {!stopped && extraTime.available && (
        <ExtraTimeButton action={actions.addExtraTime} minutes={extraTime.minutes} />
      )}

      {signUpHref && <SavePlanNote signUpHref={signUpHref} />}
    </>
  );
}
