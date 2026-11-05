"use client";

import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { getLanguageName, getLanguageNameInSentence } from "@zoonk/utils/languages";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useAppLocale } from "../_utils/locale";
import { useFormatDuration } from "../_utils/time-format";
import { useLevelName } from "../course/use-level-name";

const MINUTES_PER_HOUR = 60;

type NamedFacts = Pick<
  CertificateFacts,
  "courseLevel" | "kind" | "level" | "targetLanguage" | "title"
>;

/** The plan's estimate, so it's shown rounded: whole hours past the first one. */
export function roundStudyMinutes(minutes: number): number {
  return minutes < MINUTES_PER_HOUR
    ? minutes
    : Math.round(minutes / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;
}

function useLanguageName() {
  const locale = useAppLocale();

  return (targetLanguage: string | null) =>
    targetLanguage ? getLanguageName({ targetLanguage, userLanguage: locale }) : "";
}

export function useLanguageNameInSentence() {
  const locale = useAppLocale();

  return (targetLanguage: string | null) =>
    targetLanguage ? getLanguageNameInSentence({ targetLanguage, userLanguage: locale }) : "";
}

/**
 * A course's title, with its level for a level's certificate ("Python · Beginner"), or the language
 * and its level ("Spanish B1"), in the viewer's language.
 */
export function useCertificateName() {
  const t = useExtracted();
  const languageName = useLanguageName();
  const levelName = useLevelName();

  return (facts: NamedFacts): string => {
    if (facts.kind === "course" && facts.courseLevel) {
      return t({
        description:
          "A course level's certificate name, such as \"Python · Beginner\": the course's title, then the level's name.",
        message: "{course} · {level}",
        values: { course: facts.title ?? "", level: levelName(facts.courseLevel) },
      });
    }

    if (facts.kind === "course") {
      return facts.title ?? "";
    }

    return t({
      description: 'A language and a CEFR level, such as "Spanish B1": a certificate\'s name.',
      message: "{language} {level}",
      values: { language: languageName(facts.targetLanguage), level: facts.level ?? "" },
    });
  };
}

/** "about 41 hr", "about 45 min". */
export function useStudyTime() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return (minutes: number): string =>
    t({
      description: 'An approximate study time, such as "about 41 hr".',
      message: "about {duration}",
      values: { duration: formatDuration(roundStudyMinutes(minutes)) },
    });
}

export function useCertificateDate() {
  const formatDate = useFormatIsoDate();

  return {
    long: (isoDate: string) => formatDate(isoDate, "longYear"),
    month: (isoDate: string) => formatDate(isoDate, "month"),
    short: (isoDate: string) => formatDate(isoDate, "short"),
  };
}

/** The sentence a reader checks: the page's title and every picture's alt text. */
export function useCertificateSentence() {
  const t = useExtracted();
  const certificateName = useCertificateName();
  const languageName = useLanguageNameInSentence();

  return (facts: NamedFacts & Pick<CertificateFacts, "recipientName">): string => {
    const name = facts.recipientName;
    const level = facts.level ?? "";
    const language = languageName(facts.targetLanguage);
    const certificate = certificateName(facts);

    if (facts.kind === "languageLevel") {
      return name
        ? t("{name} completed level {level} in {language}", { language, level, name })
        : t("Level {level} in {language}, completed on Zoonk", { language, level });
    }

    return name
      ? t("{name} completed {course}", { course: certificate, name })
      : t("{course}, completed on Zoonk", { course: certificate });
  };
}
