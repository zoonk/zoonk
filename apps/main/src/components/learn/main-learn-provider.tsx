"use client";

import { WorkflowRunFollower } from "@/lib/workflow/workflow-run-follower";
import { trackEvent } from "@zoonk/core/analytics/client";
import { GenerationFollowerProvider } from "@zoonk/learn/generation/follower";
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

  return (
    <LearnProvider adapters={adapters}>
      <GenerationFollowerProvider follower={WorkflowRunFollower}>
        {children}
      </GenerationFollowerProvider>
    </LearnProvider>
  );
}
