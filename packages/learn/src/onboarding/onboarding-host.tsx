"use client";

import { type ReactNode, createContext, use } from "react";

/**
 * Where the flow shows. Inside the app's frame it's a page of its own (`page`: `/start` and a new
 * goal's questions), whose bar and title are the page's, or a section under a host page's title
 * (`section`: Today without a goal). Outside the frame (none) a screen stands on its own, such as
 * a quick explanation's wait.
 */
type OnboardingHost =
  | {
      /** Where the bar's way out leads when the learner didn't come from one of the app's pages. */
      backHref: string;
      /** What the host adds at the bar's end under `lg`, such as a visitor's "Log in". */
      barEnd: ReactNode;
      kind: "page";
    }
  | { header: ReactNode; kind: "section" };

const OnboardingHostContext = createContext<OnboardingHost | null>(null);

/**
 * The flow as a page of the app's frame (`/start`, a new goal's questions, a course's start): each
 * screen draws the page (`OnboardingColumn`), its title the page's and the flow's bar the page's
 * bar. Under `lg` the bar's way out returns to the app page the learner left for onboarding, or
 * to `backHref`; from `lg` the sidebar holds it. `barEnd` joins the bar's end under `lg`.
 */
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

/**
 * The flow under a host page's title (Today, for a learner without a goal): `header` is the host's
 * top, and each screen is a section of that page, at its edges.
 */
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

/** Where the flow shows (`OnboardingPage`, `OnboardingEmbedded`); null on a screen of its own. */
export function useOnboardingHost(): OnboardingHost | null {
  return use(OnboardingHostContext);
}

/** Whether the flow sits under a host page's title, where its screens are the page's sections. */
export function useOnboardingSection(): boolean {
  return useOnboardingHost()?.kind === "section";
}

/**
 * The flow's bar over its screens: back to the previous screen (`onBack`), where the learner is in
 * the questions in the middle (`middle`: the steps' dots, announced as "Step 2 of 4", the one place
 * the step shows) and the screen's own action on the right (`end`: Start over).
 */
export type OnboardingBar = { end?: ReactNode; middle?: ReactNode; onBack?: () => void };

export const NO_BAR: OnboardingBar = {};

/** What a page's screens draw over their content: the flow's bar and its line (a failed save). */
type OnboardingScreen = { bar: OnboardingBar; notice: ReactNode };

const OnboardingScreenContext = createContext<OnboardingScreen>({ bar: NO_BAR, notice: null });

/** The flow's bar and line, for each screen of a page of the app's frame to draw. */
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
 * A screen whose answers are final, such as a placement or level test question: the flow's bar
 * keeps no way back to the previous screen, only the way out, as on the flow's first screen.
 */
export function OnboardingNoBack({ children }: { children: ReactNode }) {
  const screen = useOnboardingScreen();

  return (
    <OnboardingScreenContext value={{ ...screen, bar: { ...screen.bar, onBack: undefined } }}>
      {children}
    </OnboardingScreenContext>
  );
}
