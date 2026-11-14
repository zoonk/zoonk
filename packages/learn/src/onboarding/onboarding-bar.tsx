"use client";

import { BackLink, PageTopBar } from "@zoonk/ui/components/page-top";
import { ProgressIndicator, ProgressRoot, ProgressTrack } from "@zoonk/ui/components/progress";
import { useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { getFormattingLocale } from "@zoonk/utils/locale";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { TaskClose } from "../_components/task-close";
import { useAppLocale } from "../_utils/locale";
import { LISTED_IN_SIDEBAR_CLASS } from "../shell/learn-bar";
import { type OnboardingBar } from "./onboarding-host";
import { testProgressPercent } from "./test-progress";

export const BAR_MIDDLE_CLASS = "w-24 sm:w-32";

/** A step's bar has its own way back, progress or menu; the entry's holds only the way out. */
export function isStepBar(bar: OnboardingBar): boolean {
  return bar.onBack !== undefined || Boolean(bar.middle) || Boolean(bar.end);
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

function BackButton({ onBack }: { onBack: () => void }) {
  const t = useExtracted();
  const ref = useEscapeClick<HTMLButtonElement>();

  return (
    <BackLink aria-label={t("Back")} render={<button onClick={onBack} ref={ref} type="button" />}>
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
      <div className="justify-self-start">{bar.onBack && <BackButton onBack={bar.onBack} />}</div>
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
      back={
        <>
          {/* `data-onboarding-bar` keeps the frame's first paint from drawing the tab bar under onboarding. */}
          <span className="contents" data-onboarding-bar="" />
          {bar.onBack ? (
            <BackButton onBack={bar.onBack} />
          ) : (
            <TaskClose className={LISTED_IN_SIDEBAR_CLASS} href={backHref} toApp />
          )}
          {/* Centered on the bar's row: 12px over it, half of its 44px. */}
          {bar.middle && (
            <div className="absolute top-8.5 left-1/2 -translate-x-1/2 -translate-y-1/2">
              {bar.middle}
            </div>
          )}
        </>
      }
    />
  );
}
