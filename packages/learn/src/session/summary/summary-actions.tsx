"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { LearnLink } from "../../learn-link";
import { SavePlanNote } from "../../onboarding/save-plan-note";
import { TaskMainLink } from "../../shell/task-frame";
import { ExtraTimeButton } from "../extra-time-button";
import { useSessionAction } from "../use-session-action";
import { useIsStopped, useSessionSummary } from "./summary-context";

/** "See mistakes", beside the main action: the notebook with what the session saved. */
export function SeeMistakesLink({ href }: { href: string }) {
  const t = useExtracted();

  return (
    <LearnLink
      className={buttonVariants({ className: "shrink-0", size: "xl", variant: "outline" })}
      href={href}
    >
      {t("See mistakes")}
    </LearnLink>
  );
}

/**
 * Back to Today, the summary's main action: a link (prefetched, so it leaves at once), followed by
 * Enter while it's shown.
 */
export function FinishLink({ className }: { className?: string }) {
  const t = useExtracted();
  const { exitHref } = useSessionSummary();

  return (
    <TaskMainLink className={className} href={exitHref}>
      {t("Finish")}
    </TaskMainLink>
  );
}

/** Right after stopping for today, the rest of the session: one tap away, beside Finish. */
export function useKeepGoing() {
  const { actions } = useSessionSummary();
  return useSessionAction({ action: actions.keepGoing });
}

export function KeepGoingButton({ keepGoing }: { keepGoing: ReturnType<typeof useKeepGoing> }) {
  const t = useExtracted();

  return (
    <Button
      className="shrink-0"
      disabled={keepGoing.isPending}
      onClick={keepGoing.run}
      size="xl"
      variant="outline"
    >
      {t("Keep going")}
    </Button>
  );
}

/** Over the actions: keeping going didn't open the next step. */
export function KeepGoingFailed({ keepGoing }: { keepGoing: ReturnType<typeof useKeepGoing> }) {
  const t = useExtracted();

  if (!keepGoing.failed) {
    return null;
  }

  return (
    <p className="text-destructive-text text-sm" role="alert">
      {t("We couldn't open the next step. Try again.")}
    </p>
  );
}

/**
 * Under the actions: "Keep learning" with the plan's next lessons after the day's session (or "10
 * more minutes" of practice once every lesson is done), while there's something left to study
 * (never past the learner's daily limit), as a quiet text button; and a guest's soft ask to save
 * their plan. A phone offers it beside Finish only (`lastStep`): under "Continue" to the rewards,
 * "Continuar" over "Continuar estudando" left Lucas guessing which one kept him studying.
 */
export function SummaryOptions({ lastStep }: { lastStep: boolean }) {
  const t = useExtracted();
  const stopped = useIsStopped();
  const { actions, signUpHref, summary } = useSessionSummary();
  const { extraTime } = summary;

  return (
    <>
      {!stopped && extraTime.available && (
        <ExtraTimeButton
          action={actions.addExtraTime}
          className={cn("lg:w-auto lg:self-end", !lastStep && "max-lg:hidden")}
          label={extraTime.lessons.length > 0 ? t("Keep learning") : undefined}
          minutes={extraTime.minutes}
        />
      )}

      {signUpHref && <SavePlanNote signUpHref={signUpHref} />}
    </>
  );
}
