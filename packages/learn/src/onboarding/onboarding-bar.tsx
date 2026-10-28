"use client";

import { ProgressIndicator, ProgressRoot, ProgressTrack } from "@zoonk/ui/components/progress";
import { useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { type ReactNode } from "react";
import { PAGE_COLUMN_CLASS } from "../_components/page";
import { CRUMB_LINK_CLASS, LearnBackLink, PageBarSurface } from "../shell/learn-bar";
import { type OnboardingBar } from "./onboarding-host";
import { testProgressPercent } from "./test-progress";

export const BAR_MIDDLE_CLASS = "w-24 sm:w-32";

export function TestProgress({ value }: { value: number }) {
  const t = useExtracted();
  const locale = useLocale();

  return (
    <ProgressRoot
      aria-label={t("Questions answered")}
      className={cn(BAR_MIDDLE_CLASS, "gap-0")}
      locale={locale}
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
    <button className={CRUMB_LINK_CLASS} onClick={onBack} ref={ref} type="button">
      <ChevronLeftIcon aria-hidden="true" />
      <span className="max-lg:sr-only">{t("Back")}</span>
    </button>
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
  const hasOwn = bar.onBack !== undefined || Boolean(bar.middle) || Boolean(bar.end);

  return (
    // `data-onboarding-bar` keeps the frame's first paint from drawing the tab bar under onboarding.
    <PageBarSurface className={cn(!hasOwn && "lg:hidden")} data-onboarding-bar="">
      <div
        className={cn(
          PAGE_COLUMN_CLASS,
          "grid min-h-11 grid-cols-[1fr_auto_1fr] items-center gap-2 lg:min-h-10",
        )}
      >
        <div className="justify-self-start max-lg:-ml-3">
          {bar.onBack ? (
            <BackButton onBack={bar.onBack} />
          ) : (
            <LearnBackLink className="lg:hidden" href={backHref} leave toApp />
          )}
        </div>

        {bar.middle ?? <span />}

        <div className="flex items-center gap-2 justify-self-end">
          {bar.end}
          {barEnd}
        </div>
      </div>
    </PageBarSurface>
  );
}
