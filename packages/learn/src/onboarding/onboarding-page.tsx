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
          <OnboardingBarRow bar={bar} />
          {notice}
          {children}
        </div>
      </Page>
    </PageWithAside>
  );
}

/** From 72rem, beside the column, unless none of the rail's blocks has more than its label. */
const RAIL_CLASS = "hidden min-[72rem]:flex min-[72rem]:not-has-[>div>:nth-child(2)]:hidden";

const SCREEN_MEASURE_CLASS = "lg:max-w-column";

/** The top bar's row sits on the screen's measured column: Back, ✕ and "…" on its edges. */
const BAR_AT_MEASURE_CLASS = cn(
  "lg:**:data-[slot=page-top-bar]:*:max-w-column lg:**:data-[slot=page-top-bar]:*:me-auto",
  "lg:**:data-[slot=bar-lead]:max-w-column lg:**:data-[slot=bar-lead]:me-auto lg:**:data-[slot=bar-lead]:w-full",
);

export function OnboardingScreenPage({
  backHref,
  barEnd,
  bottomBar,
  children,
  rail,
}: {
  backHref: string;
  barEnd: ReactNode;
  bottomBar?: ReactNode;
  children: ReactNode;
  rail: ReactNode;
}) {
  const t = useExtracted();
  const { bar, notice } = useOnboardingScreen();

  return (
    <PageWithAside
      aside={rail}
      asideClassName={RAIL_CLASS}
      asideLabel={t("Getting started")}
      className={cn("flex-1 gap-1 lg:gap-4", BAR_AT_MEASURE_CLASS)}
    >
      <OnboardingPageBar backHref={backHref} bar={bar} barEnd={barEnd} />

      <Page className={cn("flex-1 gap-6", SCREEN_MEASURE_CLASS)}>
        {notice}
        {children}
      </Page>

      {bottomBar}
    </PageWithAside>
  );
}
