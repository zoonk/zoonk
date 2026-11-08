"use client";

import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { useLevelName } from "../course/use-level-name";

const MINUTES_PER_HOUR = 60;

type NamedLevel = Pick<CertificateFacts, "cefrRange" | "courseLevel">;

type NamedFacts = NamedLevel & Pick<CertificateFacts, "title">;

/** The plan's estimate, so it's shown rounded: whole hours past the first one. */
export function roundStudyMinutes(minutes: number): number {
  return minutes < MINUTES_PER_HOUR
    ? minutes
    : Math.round(minutes / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;
}

export function useCertificateLevel() {
  const t = useExtracted();
  const levelName = useLevelName();

  return (facts: NamedLevel): string | null => {
    const level = facts.courseLevel && levelName(facts.courseLevel);

    return level && facts.cefrRange
      ? t({
          description:
            "A language course's level with the CEFR levels it covers, such as “Intermediate (B1–B2)”.",
          message: "{level} ({cefrRange})",
          values: { cefrRange: facts.cefrRange, level },
        })
      : level;
  };
}

/**
 * A course's title, with its level for a level's certificate ("Python · Beginner", "Italian ·
 * Intermediate (B1–B2)"), in the viewer's language.
 */
export function useCertificateName() {
  const t = useExtracted();
  const certificateLevel = useCertificateLevel();

  return (facts: NamedFacts): string => {
    const level = certificateLevel(facts);

    return level
      ? t({
          description:
            "A course level's certificate name, such as \"Python · Beginner\": the course's title, then the level's name.",
          message: "{course} · {level}",
          values: { course: facts.title, level },
        })
      : facts.title;
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

  return (facts: NamedFacts & Pick<CertificateFacts, "recipientName">): string => {
    const name = facts.recipientName;
    const certificate = certificateName(facts);

    return name
      ? t("{name} completed {course}", { course: certificate, name })
      : t("{course}, completed on Zoonk", { course: certificate });
  };
}
