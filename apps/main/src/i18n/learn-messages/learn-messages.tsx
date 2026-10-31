"use client";

import { type SupportedLocale, getFormattingLocale } from "@zoonk/utils/locale";
import dynamic from "next/dynamic";

/** Imported statically, every locale's catalogs would load on every page. */
const PROVIDERS = {
  de: dynamic(() => import("./de").then((module) => module.LearnMessagesDe)),
  en: dynamic(() => import("./en").then((module) => module.LearnMessagesEn)),
  es: dynamic(() => import("./es").then((module) => module.LearnMessagesEs)),
  fr: dynamic(() => import("./fr").then((module) => module.LearnMessagesFr)),
  it: dynamic(() => import("./it").then((module) => module.LearnMessagesIt)),
  ja: dynamic(() => import("./ja").then((module) => module.LearnMessagesJa)),
  ko: dynamic(() => import("./ko").then((module) => module.LearnMessagesKo)),
  pl: dynamic(() => import("./pl").then((module) => module.LearnMessagesPl)),
  pt: dynamic(() => import("./pt").then((module) => module.LearnMessagesPt)),
  tr: dynamic(() => import("./tr").then((module) => module.LearnMessagesTr)),
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

  return (
    <Provider locale={getFormattingLocale(locale)} timeZone={timeZone}>
      {children}
    </Provider>
  );
}
