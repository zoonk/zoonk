"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode, createContext, use } from "react";
import { PageSectionTitle } from "../_components/page";

const OnboardingRailContext = createContext<ReactNode>(null);

export function OnboardingRailProvider({
  children,
  rail,
}: {
  children: ReactNode;
  rail: ReactNode;
}) {
  return <OnboardingRailContext value={rail}>{children}</OnboardingRailContext>;
}

export function useOnboardingRail(): ReactNode {
  return use(OnboardingRailContext);
}

export function OnboardingRailSection({
  children,
  className,
  id,
  title,
}: {
  children: ReactNode;
  className?: string;
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
