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

/** From 72rem, beside the column. */
const RAIL_CLASS = "hidden min-[72rem]:flex";

/**
 * A screen asks one thing, so its column is centered in the room its bars span, as a task's is:
 * Back or ✕, "…" and the main action sit in that room's corners. In a room under 50rem the
 * column would stop a few pixels short of those corners, so it fills the room instead: the
 * second term is huge while the room (100%) is under 50rem and negative from there.
 */
const COLUMN_OR_ROOM_CLASS =
  "lg:mx-auto lg:max-w-[max(var(--container-column),(50rem_-_100%)*9999)]";

/** A row of the bottom bar that belongs to the column sits on it. */
const BAR_LEAD_ON_COLUMN_CLASS =
  "lg:**:data-[slot=bar-lead]:mx-auto lg:**:data-[slot=bar-lead]:w-full lg:**:data-[slot=bar-lead]:max-w-[max(var(--container-column),(50rem_-_100%)*9999)]";

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
      className={cn("flex-1 gap-1 lg:gap-2", BAR_LEAD_ON_COLUMN_CLASS)}
    >
      <OnboardingPageBar backHref={backHref} bar={bar} barEnd={barEnd} />

      <Page className={cn("flex-1 gap-6", COLUMN_OR_ROOM_CLASS)}>
        {notice}
        {children}
      </Page>

      {bottomBar}
    </PageWithAside>
  );
}
