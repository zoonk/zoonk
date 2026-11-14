"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { PlayIcon } from "lucide-react";
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
    <form action={() => void keepGoing.run()} className="contents">
      <Button
        busy={keepGoing.isPending}
        className={cn("shrink-0", className)}
        icon={<PlayIcon aria-hidden="true" />}
        size="xl"
        type="submit"
        variant="outline"
      >
        {t("Continue")}
      </Button>
    </form>
  );
}

/** More study after a full day sits in the column under Tomorrow, so the bar keeps two actions. */
export function SummaryExtraTime() {
  const t = useExtracted();
  const stopped = useIsStopped();
  const { actions, summary } = useSessionSummary();
  const { extraTime } = summary;

  if (stopped || !extraTime.available) {
    return null;
  }

  return (
    <ExtraTimeButton
      action={actions.addExtraTime}
      label={extraTime.lessons.length > 0 ? t("Keep learning") : undefined}
      minutes={extraTime.minutes}
    />
  );
}

export function SummaryOptions() {
  const { signUpHref } = useSessionSummary();

  return signUpHref ? <SavePlanNote signUpHref={signUpHref} /> : null;
}
