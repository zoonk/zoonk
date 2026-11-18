"use client";

import { BackLink, PageTopBar } from "@zoonk/ui/components/page-top";
import { ProgressIndicator, ProgressRoot, ProgressTrack } from "@zoonk/ui/components/progress";
import { useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { getFormattingLocale } from "@zoonk/utils/locale";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { StepDots } from "../_components/step-dots";
import { TaskClose } from "../_components/task-close";
import { useAppLocale } from "../_utils/locale";
import { type getProfileProgress, getSetupProgress } from "./_utils/setup-progress";
import { type OnboardingBar } from "./onboarding-host";
import { testProgressPercent } from "./test-progress";

export const BAR_MIDDLE_CLASS = "w-24 sm:w-32";

function ProfileCount({ current, total }: { current: number; total: number }) {
  const t = useExtracted();

  return (
    <span className="text-muted-foreground text-xs whitespace-nowrap">
      {t("{current, number} of {total, number}", { current, total })}
    </span>
  );
}

export function stepBarProgress(
  state: Parameters<typeof getSetupProgress>[0],
  profile: ReturnType<typeof getProfileProgress>,
) {
  if (profile) {
    return profile.total > 1 ? (
      <ProfileCount current={profile.current} total={profile.total} />
    ) : null;
  }

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
    <div
      className={cn(
        "grid min-h-11 w-full grid-cols-[1fr_auto_1fr] items-center gap-2 not-has-[a,button,[data-slot=step-dots]]:hidden",
        className,
      )}
    >
      <div className="justify-self-start">
        {bar.onBack && <BackButton disabled={bar.backDisabled} onBack={bar.onBack} />}
      </div>
      {bar.middle ?? <span />}
      <div className="justify-self-end">{bar.end}</div>
    </div>
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
