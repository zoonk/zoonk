"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { Page } from "../_components/page";
import { PageWithAside } from "../shell/learn-shell";
import { OnboardingBarRow, OnboardingPageBar } from "./onboarding-bar";
import { type OnboardingBar, useOnboardingScreen } from "./onboarding-host";
import { useOnboardingRail } from "./onboarding-rail";

/**
 * The flow under a host's title: the host's top, then the screen at the page's edges, and from
 * 72rem the flow's rail in the page's aside, as every page shows its supporting context there.
 * Under 72rem each screen shows what it needs from the rail itself.
 */
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
          {/* The chevron's glyph on the page's edge under `lg`; from `lg` its crumb sits there. */}
          <OnboardingBarRow bar={bar} className="-ml-3 lg:ml-0" />
          {notice}
          {children}
        </div>
      </Page>
    </PageWithAside>
  );
}

/**
 * A `wide` screen's own rail is made of blocks, each its label and what it says (a block with
 * nothing to say keeps only its label): with nothing to say in any of them, there's no aside.
 */
const WIDE_ASIDE_CLASS =
  "not-has-[>div>:nth-child(2)]:hidden min-[72rem]:not-has-[>div>:nth-child(2)]:hidden";

/**
 * A screen's measure from `lg`: a task's column (`max-w-column`) centered in the page, as the
 * player centers its questions, so a wide screen leaves even room on both sides of the question
 * instead of a strip on one edge.
 */
const SCREEN_MEASURE_CLASS = "lg:mx-auto lg:max-w-column";

/**
 * A screen as a page of the app's frame: the flow's bar across the page, as every page's bar is,
 * then the screen, filling a phone's or a tablet's column like any page, and from `lg` a task's
 * column centered in the page, under the bar's middle; a `wide` screen, such as the plan's reveal,
 * fills the room as a detail page does. From 72rem the rail sits in the page's aside at the right
 * edge. The flow's rail is supporting context each screen repeats where it needs it, so it's
 * hidden under 72rem; a `wide` screen's own rail follows it there, as its last sections.
 */
export function OnboardingScreenPage({
  backHref,
  barEnd,
  children,
  rail,
  wide,
}: {
  backHref: string;
  barEnd: ReactNode;
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
      // The column fills the screen's height, so a phone's next step can sit at its bottom.
      className="flex-1 gap-4"
    >
      <OnboardingPageBar backHref={backHref} bar={bar} barEnd={barEnd} />

      <Page className={cn("flex-1 gap-6", !wide && SCREEN_MEASURE_CLASS)}>
        {notice}
        {children}
      </Page>
    </PageWithAside>
  );
}
