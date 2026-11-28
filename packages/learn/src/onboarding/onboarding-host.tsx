"use client";

import { type ReactNode, createContext, use } from "react";

export const FirstLessonReadContext = createContext<ReactNode>(null);

type OnboardingHost =
  | { backHref: string; barEnd: ReactNode; kind: "page" }
  | { header: ReactNode; kind: "section"; titleClassName?: string }
  | { backHref: string; kind: "task" };

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

/**
 * Draws a page's screens as a full-screen task whose ✕ leaves where the page's way back leads.
 * Outside a page it changes nothing.
 */
export function OnboardingTask({ children }: { children: ReactNode }) {
  const host = use(OnboardingHostContext);

  if (host?.kind !== "page") {
    return children;
  }

  return (
    <OnboardingHostContext value={{ backHref: host.backHref, kind: "task" }}>
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

export type TestQuestionTop = {
  answered: number;
  groups?: readonly number[];
  /** Ends the test with the answers given; absent while stopping gives no result. */
  onStop?: () => void;
  stopHint?: string;
  /** A save is out, so stopping waits for it. */
  stopWaits?: boolean;
  title: string;
  total: number;
};

export type OnboardingBar = {
  /** While a request that moves the learner on is out, Back waits with it. */
  backDisabled?: boolean;
  end?: ReactNode;
  middle?: ReactNode;
  onBack?: () => void;
  /** The learner pressed ✕, before the page changes. */
  onClose?: () => void;
  test?: TestQuestionTop;
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
 * A test's answer is final, so its header has no way back and no "⋯", whose Start over would read
 * as starting the test over: ✕, what's being tested and one segment a question.
 */
export function OnboardingTestQuestion({
  children,
  onClose,
  ...test
}: TestQuestionTop & { children: ReactNode; onClose?: () => void }) {
  const screen = useOnboardingScreen();

  return (
    <OnboardingScreenContext value={{ ...screen, bar: { onClose, test } }}>
      {children}
    </OnboardingScreenContext>
  );
}
