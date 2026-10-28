"use client";

import { type TrackEvent } from "@zoonk/core/analytics/events";
import { type MouseEvent, type ReactNode, type Ref, createContext, use } from "react";
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
  prefetch?: boolean | "auto";
  ref?: Ref<HTMLAnchorElement>;
};

type LearnLinkComponent = (props: LearnLinkComponentProps) => ReactNode;

/** Hosts register the shared properties once, so screens send only their own. */
export type LearnAnalytics = { track: TrackEvent };

type LearnRoutes = Record<LearnTab, LearnRoute> & { signUp: LearnRoute; upgrade: LearnRoute };

/** Keep the object stable (define it at module level) so consumers don't re-render needlessly. */
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
