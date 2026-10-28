"use client";

import { getPathname } from "@/i18n/navigation";
import { trackEvent } from "@zoonk/core/analytics/client";
import { type LearnAdapters, LearnProvider } from "@zoonk/learn/provider";
import { useLocale } from "next-intl";
import { useMemo } from "react";
import { LearningLink } from "./learning-link";

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
  const locale = useLocale();

  const adapters = useMemo(
    () => ({
      ...MAIN_LEARN_ADAPTERS,
      routes: { ...MAIN_LEARN_ADAPTERS.routes, signUp: getPathname({ href: "/login", locale }) },
    }),
    [locale],
  );

  return <LearnProvider adapters={adapters}>{children}</LearnProvider>;
}
