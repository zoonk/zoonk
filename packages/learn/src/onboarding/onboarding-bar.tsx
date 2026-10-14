"use client";

import { Button } from "@zoonk/ui/components/button";
import { useEscapeClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronLeftIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { PAGE_COLUMN_CLASS } from "../_components/page";
import { LearnBackLink, PageBarSurface } from "../shell/learn-bar";
import { type OnboardingBar } from "./onboarding-host";

/** Back to the previous screen, as every bar's way back; on a page's bar Escape presses it too. */
function BackButton({ escape = false, onBack }: { escape?: boolean; onBack: () => void }) {
  const t = useExtracted();
  const ref = useEscapeClick<HTMLButtonElement>({ enabled: escape });

  return (
    <Button onClick={onBack} ref={ref} size="icon-bar" variant="ghost">
      <ChevronLeftIcon aria-hidden="true" className="size-5" />
      <span className="sr-only">{t("Back")}</span>
    </Button>
  );
}

/**
 * The bar as one row over the screen: back on the left, the middle (the steps' dots) and the
 * screen's way out on the right. A row with none of them takes no room.
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
 * screen's measure from the page's left edge: on the left the way back to the flow's previous
 * screen or, under `lg`, the way out to the app page the learner left for onboarding (Escape
 * presses either); in the middle the steps' dots; on the right the screen's way out and the
 * host's. From `lg` the sidebar holds the way out, so a screen with nothing else in its bar has
 * none there, and its title sits where every page's does.
 */
export function OnboardingPageBar({
  backHref,
  bar,
  barEnd,
  wide,
}: {
  backHref: string;
  bar: OnboardingBar;
  barEnd: ReactNode;
  wide: boolean;
}) {
  const hasOwn = bar.onBack !== undefined || Boolean(bar.middle) || Boolean(bar.end);

  return (
    // `data-onboarding-bar` keeps the frame's first paint from drawing the tab bar under onboarding.
    <PageBarSurface className={cn(!hasOwn && "lg:hidden")} data-onboarding-bar="">
      <div
        className={cn(
          PAGE_COLUMN_CLASS,
          !wide && "max-w-column",
          "grid min-h-11 grid-cols-[1fr_auto_1fr] items-center gap-2 lg:min-h-10",
        )}
      >
        {/* From `lg` the chevron's and the ✕'s glyphs line up with the screen's edges. */}
        <div className="justify-self-start lg:-ml-2.5">
          {bar.onBack ? (
            <BackButton escape onBack={bar.onBack} />
          ) : (
            <LearnBackLink className="lg:hidden" href={backHref} toApp />
          )}
        </div>

        {bar.middle ?? <span />}

        <div className="flex items-center gap-2 justify-self-end lg:-mr-2.5">
          {bar.end}
          {barEnd}
        </div>
      </div>
    </PageBarSurface>
  );
}
