"use client";

import { type ReactNode, createContext, use } from "react";
import { TestProgress } from "./onboarding-bar";

type OnboardingHost =
  | { backHref: string; barEnd: ReactNode; kind: "page" }
  | { header: ReactNode; kind: "section" };

const OnboardingHostContext = createContext<OnboardingHost | null>(null);

export function OnboardingPage({
  backHref,
  barEnd = null,
  children,
}: {
  backHref: string;
  barEnd?: ReactNode;
  children: ReactNode;
}) {
  return (
    <OnboardingHostContext value={{ backHref, barEnd, kind: "page" }}>
      {children}
    </OnboardingHostContext>
  );
}

export function OnboardingEmbedded({
  children,
  header,
}: {
  children: ReactNode;
  header: ReactNode;
}) {
  return (
    <OnboardingHostContext value={{ header, kind: "section" }}>{children}</OnboardingHostContext>
  );
}

export function useOnboardingHost(): OnboardingHost | null {
  return use(OnboardingHostContext);
}

export function useOnboardingSection(): boolean {
  return useOnboardingHost()?.kind === "section";
}

export type OnboardingBar = { end?: ReactNode; middle?: ReactNode; onBack?: () => void };

export const NO_BAR: OnboardingBar = {};

type OnboardingScreen = { bar: OnboardingBar; notice: ReactNode };

const OnboardingScreenContext = createContext<OnboardingScreen>({ bar: NO_BAR, notice: null });

export function OnboardingScreenProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: OnboardingScreen;
}) {
  return <OnboardingScreenContext value={value}>{children}</OnboardingScreenContext>;
}

export function useOnboardingScreen(): OnboardingScreen {
  return use(OnboardingScreenContext);
}

/** A test's answer is final, so its bar has no way back and no "⋯", whose Start over would read as starting the test over. `progress` is 0 to 1. */
export function OnboardingTestQuestion({
  children,
  progress,
}: {
  children: ReactNode;
  progress: number;
}) {
  const screen = useOnboardingScreen();

  return (
    <OnboardingScreenContext
      value={{ ...screen, bar: { middle: <TestProgress value={progress} /> } }}
    >
      {children}
    </OnboardingScreenContext>
  );
}
