"use client";

import { type SupportedLocale } from "@zoonk/utils/locale";
import dynamic from "next/dynamic";

/**
 * Each locale's catalogs in a script of their own, loaded only for the learner's locale: imported
 * statically, every locale's would load on every page.
 */
const PROVIDERS = {
  de: dynamic(() => import("./de").then((module) => module.LearnMessagesDe)),
  en: dynamic(() => import("./en").then((module) => module.LearnMessagesEn)),
  es: dynamic(() => import("./es").then((module) => module.LearnMessagesEs)),
  fr: dynamic(() => import("./fr").then((module) => module.LearnMessagesFr)),
  pt: dynamic(() => import("./pt").then((module) => module.LearnMessagesPt)),
} satisfies Record<SupportedLocale, unknown>;

export function LearnMessages({
  children,
  locale,
  timeZone,
}: {
  children: React.ReactNode;
  locale: SupportedLocale;
  timeZone: string;
}) {
  const Provider = PROVIDERS[locale];
  return <Provider timeZone={timeZone}>{children}</Provider>;
}
