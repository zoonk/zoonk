"use client";

import { useLocale } from "next-intl";

/**
 * Messages name it in a `select`, so each language writes it with its own article ("o ENEM", "le
 * bac").
 */
type LocalExam = "abitur" | "bac" | "enem" | "pau" | "sat";

const LOCAL_EXAMS: Record<string, LocalExam> = {
  de: "abitur",
  en: "sat",
  es: "pau",
  fr: "bac",
  pt: "enem",
};

/** The language suggested is never the page's own. */
export function useLocalGoalExample(): { exam: LocalExam; language: string } {
  const locale = useLocale();
  const spoken = locale === "en" ? "es" : "en";

  return {
    exam: LOCAL_EXAMS[locale] ?? "sat",
    // Mid-sentence, so the name keeps the language's own casing ("inglês", "Spanish").
    language: new Intl.DisplayNames([locale], { type: "language" }).of(spoken) ?? spoken,
  };
}
