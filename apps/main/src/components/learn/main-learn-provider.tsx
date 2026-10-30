"use client";

import { trackEvent } from "@zoonk/core/analytics/client";
import { type LearnAdapters, LearnProvider } from "@zoonk/learn/provider";
import { useMemo } from "react";
import { LearningLink } from "./learning-link";
import { useSignUpHref } from "./use-sign-up-href";

const MAIN_LEARN_ADAPTERS: LearnAdapters = {
  analytics: { track: trackEvent },
  linkComponent: LearningLink,
  routes: {
    buddy: "/buddy",
    journey: "/plan",
    signUp: "/login",
    today: "/today",
    upgrade: "/subscription",
  },
};

export function MainLearnProvider({ children }: { children: React.ReactNode }) {
  const signUp = useSignUpHref();

  const adapters = useMemo(
    () => ({ ...MAIN_LEARN_ADAPTERS, routes: { ...MAIN_LEARN_ADAPTERS.routes, signUp } }),
    [signUp],
  );

  return <LearnProvider adapters={adapters}>{children}</LearnProvider>;
}
