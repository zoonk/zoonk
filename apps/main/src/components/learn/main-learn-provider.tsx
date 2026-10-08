"use client";

import { Link } from "@/i18n/navigation";
import { trackEvent } from "@zoonk/core/analytics/client";
import { type LearnAdapters, LearnProvider } from "@zoonk/learn/provider";

const MAIN_LEARN_ADAPTERS: LearnAdapters = {
  analytics: { track: trackEvent },
  linkComponent: Link,
  routes: {
    buddy: "/buddy",
    journey: "/journey",
    signUp: "/login",
    today: "/today",
    upgrade: "/subscription",
  },
};

/** Gives `@zoonk/learn` screens main's links and analytics. */
export function MainLearnProvider({ children }: { children: React.ReactNode }) {
  return <LearnProvider adapters={MAIN_LEARN_ADAPTERS}>{children}</LearnProvider>;
}
