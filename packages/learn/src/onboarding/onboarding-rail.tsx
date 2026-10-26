"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode, createContext, use } from "react";
import { PageSectionTitle } from "../_components/page";

/**
 * What every screen of a flow shows in the page's aside from 72rem (`OnboardingColumn`): the plan
 * so far, or how it works before there's a plan. A screen can put its own there instead.
 */
const OnboardingRailContext = createContext<ReactNode>(null);

/** The rail every screen of the flow shows in the page's aside, unless the screen has its own. */
export function OnboardingRailProvider({
  children,
  rail,
}: {
  children: ReactNode;
  rail: ReactNode;
}) {
  return <OnboardingRailContext value={rail}>{children}</OnboardingRailContext>;
}

/** The flow's rail, null for a flow without one (an explanation, a course's start). */
export function useOnboardingRail(): ReactNode {
  return use(OnboardingRailContext);
}

/** A block of the rail (or of a screen's own column on phones): its title, then its rows. */
export function OnboardingRailSection({
  children,
  className,
  id,
  title,
}: {
  children: ReactNode;
  className?: string;
  /** Names the section for screen readers by its label. */
  id: string;
  title: string;
}) {
  return (
    <section aria-labelledby={id} className={cn("flex flex-col gap-2", className)}>
      <PageSectionTitle id={id}>{title}</PageSectionTitle>
      {children}
    </section>
  );
}
