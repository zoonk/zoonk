"use client";

import { BackLink, PageTopBar, PageTopRow } from "@zoonk/ui/components/page-top";
import { ProgressIndicator, ProgressRoot, ProgressTrack } from "@zoonk/ui/components/progress";
import { useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { getFormattingLocale } from "@zoonk/utils/locale";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { StepDots } from "../_components/step-dots";
import { TaskClose } from "../_components/task-close";
import { useAppLocale } from "../_utils/locale";
import { getSetupProgress } from "./_utils/setup-progress";
import { type OnboardingBar } from "./onboarding-host";
import { testProgressPercent } from "./test-progress";

export const BAR_MIDDLE_CLASS = "w-24 max-w-full sm:w-32";

/** One display for the whole setup: the questions about the learner share one dash. */
export function stepBarProgress(state: Parameters<typeof getSetupProgress>[0]) {
  const setup = getSetupProgress(state);

  return (
    setup && <StepDots className={BAR_MIDDLE_CLASS} current={setup.current} total={setup.total} />
  );
}

export function TestProgress({ value }: { value: number }) {
  const t = useExtracted();
  const locale = useAppLocale();

  return (
    <ProgressRoot
      aria-label={t("Questions answered")}
      className={cn(BAR_MIDDLE_CLASS, "gap-0")}
      locale={getFormattingLocale(locale)}
      value={testProgressPercent(value)}
    >
      <ProgressTrack className="bg-surface-3 h-1 rounded-xs">
        <ProgressIndicator className="bg-foreground rounded-xs motion-reduce:transition-none" />
      </ProgressTrack>
    </ProgressRoot>
  );
}

function BackButton({ disabled, onBack }: { disabled?: boolean; onBack: () => void }) {
  const t = useExtracted();
  const ref = useEscapeClick<HTMLButtonElement>();

  return (
    <BackLink
      aria-label={t("Back")}
      render={<button disabled={disabled} onClick={onBack} ref={ref} type="button" />}
    >
      {t("Back")}
    </BackLink>
  );
}

export function OnboardingBarRow({ bar, className }: { bar: OnboardingBar; className?: string }) {
  return (
    <PageTopRow
      actions={bar.end}
      back={bar.onBack && <BackButton disabled={bar.backDisabled} onBack={bar.onBack} />}
      className={cn("w-full not-has-[a,button,[data-slot=step-dots]]:hidden", className)}
      middle={bar.middle}
    />
  );
}

export function OnboardingPageBar({
  backHref,
  bar,
  barEnd,
}: {
  backHref: string;
  bar: OnboardingBar;
  barEnd: ReactNode;
}) {
  return (
    <PageTopBar
      actions={
        <>
          {bar.end}
          {barEnd}
        </>
      }
      middle={bar.middle}
      back={
        <>
          {/* `data-onboarding-bar` keeps the frame's first paint from drawing the tab bar under onboarding. */}
          <span className="contents" data-onboarding-bar="" />
          {bar.onBack ? (
            <BackButton disabled={bar.backDisabled} onBack={bar.onBack} />
          ) : (
            <TaskClose href={backHref} toApp />
          )}
        </>
      }
    />
  );
}
