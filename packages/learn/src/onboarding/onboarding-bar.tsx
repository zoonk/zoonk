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

/** The bar's middle, the steps' dots or a test's progress, as wide as one another. */
export const BAR_MIDDLE_CLASS = "w-24 sm:w-32";

const PERCENT = 100;

/**
 * How far into a test the learner is (placement, a language's level test), from 0 to 1, where the
 * steps' dots sit: one bar in the text color, as a task told as one run shows it.
 */
export function TestProgress({ value }: { value: number }) {
  const t = useExtracted();
  const locale = useLocale();

  return (
    <ProgressRoot
      aria-label={t("Questions answered")}
      className={cn(BAR_MIDDLE_CLASS, "gap-0")}
      locale={locale}
      value={Math.round(Math.min(1, Math.max(0, value)) * PERCENT)}
    >
      <ProgressTrack className="bg-surface-3 h-1 rounded-xs">
        <ProgressIndicator className="bg-foreground rounded-xs motion-reduce:transition-none" />
      </ProgressTrack>
    </ProgressRoot>
  );
}

/**
 * Back to the flow's previous screen: a chevron under `lg`, "‹ Back" from `lg`, in the face of a
 * page's breadcrumb. On a page's bar Escape presses it too.
 */
function BackButton({ escape = false, onBack }: { escape?: boolean; onBack: () => void }) {
  const t = useExtracted();
  const ref = useEscapeClick<HTMLButtonElement>({ enabled: escape });

  return (
    <button className={CRUMB_LINK_CLASS} onClick={onBack} ref={ref} type="button">
      <ChevronLeftIcon aria-hidden="true" />
      <span className="max-lg:sr-only">{t("Back")}</span>
    </button>
  );
}

/**
 * The bar as one row over the screen: back on the left, the middle (the steps' dots) and the
 * screen's own action on the right. A row with none of them takes no room.
 */
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

/**
 * An onboarding page's bar, where every page's bar sits (`PageBarSurface`), its row on the
 * screen's edges (`className`: from `lg` the centered column, so its controls sit over the question
 * they act on, as a task's do): on the left the way back to the flow's previous screen or, where
 * there's none and under `lg`, an ✕ out to the app page the learner left for onboarding (Escape
 * presses either); in the middle the steps' dots, or a test's progress; on the right the screen's
 * own action (the "⋯" with finishing later and starting over) and the host's. From `lg` the sidebar
 * holds the way out, so a screen with nothing else in its bar has none there, and its title sits
 * where every page's does.
 */
export function OnboardingPageBar({
  backHref,
  bar,
  barEnd,
  className,
}: {
  backHref: string;
  bar: OnboardingBar;
  barEnd: ReactNode;
  className?: string;
}) {
  const hasOwn = bar.onBack !== undefined || Boolean(bar.middle) || Boolean(bar.end);

  return (
    // `data-onboarding-bar` keeps the frame's first paint from drawing the tab bar under onboarding.
    <PageBarSurface className={cn(!hasOwn && "lg:hidden")} data-onboarding-bar="">
      <div
        className={cn(
          PAGE_COLUMN_CLASS,
          "grid min-h-11 grid-cols-[1fr_auto_1fr] items-center gap-2 lg:min-h-10",
          className,
        )}
      >
        {/* Under `lg` the chevron's and the ✕'s glyphs sit on the column's edge, as the "⋯"'s does. */}
        <div className="justify-self-start max-lg:-ml-3">
          {bar.onBack ? (
            <BackButton escape onBack={bar.onBack} />
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
