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

export const SHARED_ROW_ACTION_CLASS = "max-lg:grow";

export function SeeMistakesLink({ className, href }: { className?: string; href: string }) {
  const t = useExtracted();

  return (
    <LearnLink
      className={buttonVariants({
        className: cn("shrink-0", className),
        size: "xl",
        variant: "outline",
      })}
      href={href}
    >
      {t("See mistakes")}
    </LearnLink>
  );
}

export function FinishLink({ className }: { className?: string }) {
  const t = useExtracted();
  const { exitHref } = useSessionSummary();

  return (
    <TaskMainLink className={className} href={exitHref}>
      {t("Finish")}
    </TaskMainLink>
  );
}

export function useKeepGoing() {
  const { actions } = useSessionSummary();
  return useSessionAction({ action: actions.keepGoing });
}

export function KeepGoingButton({
  className,
  keepGoing,
}: {
  className?: string;
  keepGoing: ReturnType<typeof useKeepGoing>;
}) {
  const t = useExtracted();

  return (
    <Button
      className={cn("shrink-0", className)}
      disabled={keepGoing.isPending}
      onClick={keepGoing.run}
      size="xl"
      variant="outline"
    >
      {t("Keep going")}
    </Button>
  );
}

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
 * On a phone, only beside Finish (`lastStep`): two "Continue" buttons would leave the learner
 * guessing which one keeps them studying.
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
