import "server-only";
import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { type LanguageSkill } from "@zoonk/db";
import { getExtracted } from "next-intl/server";
import {
  formatCertificateDate,
  formatCount,
  formatStudyTime,
  getStudyTimeStat,
} from "./certificate-format";

export type Readout = { label: string; value: string };

export type CertificateStat = { label: string; unit: string; value: string };

export type KindInput = { facts: CertificateFacts; locale: string };

export async function getSkillReadouts({ facts, locale }: KindInput): Promise<Readout[]> {
  const t = await getExtracted({ locale });

  const skillNames: Record<LanguageSkill, string> = {
    listening: t("Listening"),
    reading: t("Reading"),
    speaking: t("Speaking"),
    writing: t("Writing"),
  };

  return facts.skillLevels.map((skillLevel) => ({
    label: skillNames[skillLevel.skill],
    value: skillLevel.label,
  }));
}

/** Completed, lessons studied, lessons passed by test (when any) and study time (when known). */
export async function getStudyFacts({ facts, locale }: KindInput): Promise<Readout[]> {
  const t = await getExtracted({ locale });
  const lessonsTestedOut = facts.lessonsTestedOut ?? 0;

  const completed = {
    label: t({
      description: "A certificate's fact: the day the learner finished the course or level.",
      message: "Completed",
    }),
    value: formatCertificateDate({ isoDate: facts.completedOn, locale }),
  };

  const lessonsStudied = {
    label: t({
      description: "A certificate's fact: how many of the plan's lessons the learner studied.",
      message: "Lessons studied",
    }),
    value: formatCount({ count: facts.lessonsStudied ?? 0, locale }),
  };

  const testedOut = {
    label: t({
      description:
        "A certificate's fact: lessons the learner skipped by passing a test, said for outsiders.",
      message: "Passed by test",
    }),
    value: formatCount({ count: lessonsTestedOut, locale }),
  };

  const studyTime = facts.minutes !== null && {
    label: t({
      description:
        "A certificate's fact: about how long the studied lessons take. In Brazilian Portuguese: “Carga horária”.",
      message: "Study time",
    }),
    value: t({
      description:
        "A certificate's study time, the plan's estimate for the lessons studied, such as “about 41 hr”. Brazilian schools read it as the certificate's workload (carga horária).",
      message: "about {duration}",
      values: { duration: formatStudyTime({ locale, minutes: facts.minutes }) },
    }),
  };

  return [completed, lessonsStudied, lessonsTestedOut > 0 && testedOut, studyTime].filter(
    (fact) => fact !== false,
  );
}

/** The post's big numbers: lessons studied and, when known, the hours they take. */
export async function getStudyStats({ facts, locale }: KindInput): Promise<CertificateStat[]> {
  const t = await getExtracted({ locale });
  const lessonsStudied = facts.lessonsStudied ?? 0;

  const lessons = {
    label: t({
      description:
        "Under a big number on a certificate's social post: how many lessons the learner studied.",
      message: "{count, plural, =0 {lessons studied} one {lesson studied} other {lessons studied}}",
      values: { count: lessonsStudied },
    }),
    unit: "",
    value: formatCount({ count: lessonsStudied, locale }),
  };

  const studyTime = facts.minutes !== null && {
    ...getStudyTimeStat({ locale, minutes: facts.minutes }),
    label: t({
      description:
        "Under a big number of hours on a certificate's social post, such as “~41 h” over “of study”.",
      message: "of study",
    }),
  };

  return [lessons, studyTime].filter((stat) => stat !== false);
}
