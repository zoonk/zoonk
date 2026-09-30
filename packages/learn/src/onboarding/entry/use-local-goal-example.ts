"use client";

import { useLocale } from "next-intl";

/**
 * A well-known exam in each interface language, so the example feels local. Messages name it in a
 * `select`, so each language writes it with its own article ("o ENEM", "la PAU", "le bac").
 */
type LocalExam = "abitur" | "bac" | "enem" | "pau" | "sat";

const LOCAL_EXAMS: Record<string, LocalExam> = {
  de: "abitur",
  en: "sat",
  es: "pau",
  fr: "bac",
  pt: "enem",
};

/**
 * What onboarding's examples suggest, in the interface language: a local exam, and a language to
 * speak that isn't the page's own, since a page never suggests learning the language it's in.
 */
export function useLocalGoalExample(): { exam: LocalExam; language: string } {
  const locale = useLocale();
  const spoken = locale === "en" ? "es" : "en";

  return {
    exam: LOCAL_EXAMS[locale] ?? "sat",
    // Mid-sentence, so the name keeps the language's own casing ("inglês", "Spanish").
    language: new Intl.DisplayNames([locale], { type: "language" }).of(spoken) ?? spoken,
  };
}
