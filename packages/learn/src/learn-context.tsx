"use client";

import { type TrackEvent } from "@zoonk/core/analytics/events";
import { type ReactNode, type Ref, createContext, use, useMemo } from "react";
import { useOptionalExperienceMode } from "./mode-provider";
import { type LearnTab } from "./shell/learn-tabs";

/** Hosts pass their own typed routes; the package only needs them as strings. */
type LearnRoute = string;

export type LearnLinkComponentProps = {
  "aria-current"?: "page";
  /** Optional so a link can be a menu item's `render` element, which supplies the children. */
  children?: ReactNode;
  className?: string;
  href: LearnRoute;
  prefetch?: boolean;
  /** The screen's main link takes a ref, so Enter can follow it from anywhere on the screen. */
  ref?: Ref<HTMLAnchorElement>;
};

type LearnLinkComponent = (props: LearnLinkComponentProps) => ReactNode;

/**
 * Events come from the shared catalog in core. Shared properties are registered once by the
 * host, so screens send only their own properties; `useLearnAnalytics` adds the mode on screen.
 */
export type LearnAnalytics = { track: TrackEvent };

/**
 * The tabs, the buddy's page (where Fun's dock buddy leads; Focus has no buddy), and where a guest
 * creates an account (`signUp`) and a free learner sees Plus (`upgrade`).
 */
type LearnRoutes = Record<LearnTab, LearnRoute> & {
  buddy: LearnRoute;
  signUp: LearnRoute;
  upgrade: LearnRoute;
};

/**
 * Everything the learning screens need from their host app. Keep the object
 * stable (define it at module level) so consumers don't re-render needlessly.
 */
export type LearnAdapters = {
  analytics: LearnAnalytics;
  linkComponent: LearnLinkComponent;
  routes: LearnRoutes;
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

/**
 * The host's analytics with the mode on screen, so an event carries the mode the learner sees
 * even before the host registers its shared properties, or right after onboarding's mode step.
 */
export function useLearnAnalytics(): LearnAnalytics {
  const { analytics } = useLearnAdapters();
  const mode = useOptionalExperienceMode();

  return useMemo(
    () =>
      mode
        ? { track: (event, options) => analytics.track(event, { mode, ...options }) }
        : analytics,
    [analytics, mode],
  );
}

export function useLearnRoutes(): LearnRoutes {
  return useLearnAdapters().routes;
}
