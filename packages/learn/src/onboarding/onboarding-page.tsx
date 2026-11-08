"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { Page } from "../_components/page";
import { PageWithAside } from "../shell/learn-shell";
import { OnboardingBarRow, OnboardingPageBar } from "./onboarding-bar";
import { type OnboardingBar, useOnboardingScreen } from "./onboarding-host";
import { useOnboardingRail } from "./onboarding-rail";

export function OnboardingSectionFrame({
  bar,
  children,
  header,
  notice,
}: {
  bar: OnboardingBar;
  children: ReactNode;
  header: ReactNode;
  notice: ReactNode;
}) {
  const t = useExtracted();
  const rail = useOnboardingRail();

  return (
    <PageWithAside
      aside={rail}
      asideClassName="hidden min-[72rem]:flex"
      asideLabel={t("Getting started")}
    >
      <Page className="gap-6">
        {header}

        <div className="flex flex-col" data-slot="onboarding-frame">
          <OnboardingBarRow bar={bar} className="-ml-3 lg:ml-0" />
          {notice}
          {children}
        </div>
      </Page>
    </PageWithAside>
  );
}

/** Hides the aside when none of the rail's blocks has more than its label. */
const WIDE_ASIDE_CLASS =
  "not-has-[>div>:nth-child(2)]:hidden min-[72rem]:not-has-[>div>:nth-child(2)]:hidden";

const SCREEN_MEASURE_CLASS = "lg:mx-auto lg:max-w-column";

/**
 * Reaches past the page's own padding (the shell's, or the column's beside an aside), so its
 * hairline runs across the page and it rests on the screen's bottom edge.
 */
const BOTTOM_BAR_CLASS =
  "bg-background border-border sticky bottom-0 z-10 -mx-4 -mb-12 border-t px-4 empty:hidden pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:-mx-8 sm:px-8 lg:-mx-10 lg:-mb-16 lg:px-10";

export function OnboardingScreenPage({
  backHref,
  barEnd,
  bottomBar,
  children,
  rail,
  wide,
}: {
  backHref: string;
  barEnd: ReactNode;
  bottomBar?: ReactNode;
  children: ReactNode;
  rail: ReactNode;
  wide: boolean;
}) {
  const t = useExtracted();
  const { bar, notice } = useOnboardingScreen();

  return (
    <PageWithAside
      aside={rail}
      asideClassName={wide ? WIDE_ASIDE_CLASS : "hidden min-[72rem]:flex"}
      asideLabel={t("Getting started")}
      className="flex-1 gap-4"
    >
      <OnboardingPageBar backHref={backHref} bar={bar} barEnd={barEnd} />

      <Page className={cn("flex-1 gap-6", !wide && SCREEN_MEASURE_CLASS)}>
        {notice}
        {children}
      </Page>

      {bottomBar && (
        <div className={BOTTOM_BAR_CLASS} data-slot="onboarding-bottom-bar">
          {bottomBar}
        </div>
      )}
    </PageWithAside>
  );
}
