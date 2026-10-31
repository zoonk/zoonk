"use client";

import { useExtracted } from "next-intl";
import { useAppLocale } from "../../_utils/locale";

/**
 * Messages name it in a `select`, so each language writes it with its own article ("o ENEM", "le
 * bac").
 */
type LocalExam =
  | "abitur"
  | "bac"
  | "enem"
  | "exani"
  | "kyotsu"
  | "matura"
  | "maturita"
  | "sat"
  | "suneung"
  | "yks";

const LOCAL_EXAMS: Record<string, LocalExam> = {
  de: "abitur",
  en: "sat",
  es: "exani",
  fr: "bac",
  it: "maturita",
  ja: "kyotsu",
  ko: "suneung",
  pl: "matura",
  pt: "enem",
  tr: "yks",
};

/** The language suggested is never the page's own. */
export function useLocalGoalExample(): { exam: LocalExam; language: string } {
  const locale = useAppLocale();
  const spoken = locale === "en" ? "es" : "en";

  return {
    exam: LOCAL_EXAMS[locale] ?? "sat",
    // Mid-sentence, so the name keeps the language's own casing ("inglês", "Spanish").
    language: new Intl.DisplayNames([locale], { type: "language" }).of(spoken) ?? spoken,
  };
}

export function useLocalExamGoal(): string {
  const t = useExtracted();
  const { exam } = useLocalGoalExample();

  return t({
    description:
      "Each branch names its own exam as people there call it (共通テスト, 수능): keep that exam in it, never another country's.",
    message:
      "{exam, select, abitur {Pass the Abitur} bac {Pass the bac} enem {Pass the ENEM} exani {Pass the EXANI-II} kyotsu {Do well on the Common Test} matura {Pass the matura} maturita {Pass the maturità} suneung {Do well on the CSAT} yks {Do well on the YKS} other {Pass the SAT}}",
    values: { exam },
  });
}
