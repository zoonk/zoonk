"use client";

import { type TrackEvent } from "@zoonk/core/analytics/events";
import { type MouseEvent, type ReactNode, type Ref, createContext, use } from "react";
import { type CountryChoice } from "./country/country-choice";
import { type LearnTab } from "./shell/learn-tabs";

type LearnRoute = string;

export type LearnLinkComponentProps = {
  "aria-current"?: "page";
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children?: ReactNode;
  className?: string;
  href: LearnRoute;
  lessonWritten?: boolean;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /** Runs only for a navigation the router makes, so a click with a modifier still opens a new tab. */
  onNavigate?: (event: { preventDefault: () => void }) => void;
  prefetch?: boolean | "auto";
  ref?: Ref<HTMLAnchorElement>;
  scroll?: boolean;
  unstable_dynamicOnHover?: boolean;
};

type LearnLinkComponent = (props: LearnLinkComponentProps) => ReactNode;

/** Hosts register the shared properties once, so screens send only their own. */
export type LearnAnalytics = { track: TrackEvent };

type LearnRoutes = Record<LearnTab, LearnRoute> & { signUp: LearnRoute; upgrade: LearnRoute };

/** Keep the object stable (define it at module level) so consumers don't re-render needlessly. */
export type LearnAdapters = {
  analytics: LearnAnalytics;
  mockSchedule?: {
    dates: (planItemId: string) => Promise<string[] | null>;
    change: (planItemId: string, date: string | null) => Promise<string | null>;
    undo: (planItemId: string, changeId: string) => Promise<boolean>;
    showToday: () => void;
  };
  /** Every country, named and sorted in `language`; null when it couldn't be read. */
  loadCountries: (language: string) => Promise<CountryChoice[] | null>;
  linkComponent: LearnLinkComponent;
  routes: LearnRoutes;
  /**
   * Starts a written task the learner asked for (the goal's next, or `taskKey`'s) and opens it.
   * False when it couldn't. Hosts without written practice leave it out.
   */
  writeNow?: (input: { goalId: string; taskKey?: string }) => Promise<boolean>;
};

export const LearnAdaptersContext = createContext<LearnAdapters | null>(null);

function useLearnAdapters(): LearnAdapters {
  const adapters = use(LearnAdaptersContext);

  if (!adapters) {
    throw new Error("Learn components must be used within a LearnProvider");
  }

  return adapters;
}

export function useLearnLinkComponent(): LearnLinkComponent {
  return useLearnAdapters().linkComponent;
}

export function useLearnAnalytics(): LearnAnalytics {
  return useLearnAdapters().analytics;
}

export function useLoadCountries(): LearnAdapters["loadCountries"] {
  return useLearnAdapters().loadCountries;
}

export function useWriteNow(): LearnAdapters["writeNow"] {
  return useLearnAdapters().writeNow;
}

export function useLearnRoutes(): LearnRoutes {
  return useLearnAdapters().routes;
}

export function useMockSchedule() {
  return useLearnAdapters().mockSchedule;
}
