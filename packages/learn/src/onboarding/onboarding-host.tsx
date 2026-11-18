"use client";

import { type ReactNode, createContext, use } from "react";
import { TestProgress } from "./onboarding-bar";

export const FirstLessonReadContext = createContext<ReactNode>(null);

type OnboardingHost =
  | { backHref: string; barEnd: ReactNode; kind: "page" }
  | { header: ReactNode; kind: "section"; titleClassName?: string };

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

/** `titleClassName` hides the section's title where the page's own menu already says it. */
export function OnboardingEmbedded({
  children,
  header,
  titleClassName,
}: {
  children: ReactNode;
  header: ReactNode;
  titleClassName?: string;
}) {
  return (
    <OnboardingHostContext value={{ header, kind: "section", titleClassName }}>
      {children}
    </OnboardingHostContext>
  );
}

export function useOnboardingHost(): OnboardingHost | null {
  return use(OnboardingHostContext);
}

export function useOnboardingSection(): boolean {
  return useOnboardingHost()?.kind === "section";
}

export type OnboardingBar = {
  /** While a request that moves the learner on is out, Back waits with it. */
  backDisabled?: boolean;
  end?: ReactNode;
  middle?: ReactNode;
  onBack?: () => void;
};

export const NO_BAR: OnboardingBar = {};

type OnboardingScreen = { bar: OnboardingBar; failure: ReactNode; notice: ReactNode };

const OnboardingScreenContext = createContext<OnboardingScreen>({
  bar: NO_BAR,
  failure: null,
  notice: null,
});

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

/**
 * A test's answer is final, so its bar has no way back and no "⋯", whose Start over would read as
 * starting the test over. `progress` is 0 to 1.
 */
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
