"use client";

import { type TrackEvent } from "@zoonk/core/analytics/events";
import { type MouseEvent, type ReactNode, type Ref, createContext, use } from "react";
import { type LearnTab } from "./shell/learn-tabs";

/** Hosts pass their own typed routes; the package only needs them as strings. */
type LearnRoute = string;

export type LearnLinkComponentProps = {
  "aria-current"?: "page";
  /** Optional so a link can be a menu item's `render` element, which supplies the children. */
  children?: ReactNode;
  className?: string;
  href: LearnRoute;
  /** Runs before the host navigates; preventing its default keeps the link from navigating. */
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  /**
   * `true` (the default) loads the destination with this link's own data before the tap, a server
   * render per visible link; `"auto"` loads only what every link to that route shares.
   */
  prefetch?: boolean | "auto";
  /** The screen's main link takes a ref, so Enter can follow it from anywhere on the screen. */
  ref?: Ref<HTMLAnchorElement>;
};

type LearnLinkComponent = (props: LearnLinkComponentProps) => ReactNode;

/**
 * Events come from the shared catalog in core. Shared properties are registered once by the
 * host, so screens send only their own properties.
 */
export type LearnAnalytics = { track: TrackEvent };

/**
 * The tabs, and where a guest creates an account (`signUp`) and a free learner sees Plus
 * (`upgrade`).
 */
type LearnRoutes = Record<LearnTab, LearnRoute> & { signUp: LearnRoute; upgrade: LearnRoute };

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

export function useLearnAnalytics(): LearnAnalytics {
  return useLearnAdapters().analytics;
}

export function useLearnRoutes(): LearnRoutes {
  return useLearnAdapters().routes;
}
