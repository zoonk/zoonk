import "server-only";
import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { getExtracted } from "next-intl/server";
import {
  formatCertificateDate,
  formatCount,
  formatStudyTime,
  getShownStudyCounts,
  getStudyTimeStat,
} from "./certificate-format";

export type Readout = { label: string; value: string };

export type CertificateStat = { label: string; unit: string; value: string };

export type KindInput = { facts: CertificateFacts; locale: string };

export async function getStudyFacts({ facts, locale }: KindInput): Promise<Readout[]> {
  const t = await getExtracted({ locale });
  const { lessonsStudied, lessonsTestedOut, minutes } = getShownStudyCounts(facts);

  const completed = {
    label: t({
      description: "A certificate's fact: the day the learner finished the course or level.",
      message: "Completed",
    }),
    value: formatCertificateDate({ isoDate: facts.completedOn, locale }),
  };

  const studied = lessonsStudied !== null && {
    label: t({
      description: "A certificate's fact: how many of the plan's lessons the learner studied.",
      message: "Lessons studied",
    }),
    value: formatCount({ count: lessonsStudied, locale }),
  };

  const testedOut = lessonsTestedOut !== null && {
    label: t({
      description:
        "A certificate's fact: lessons the learner skipped by passing a test, said for outsiders.",
      message: "Passed by test",
    }),
    value: formatCount({ count: lessonsTestedOut, locale }),
  };

  const studyTime = minutes !== null && {
    label: t({
      description:
        "A certificate's fact: about how long the studied lessons take. In Brazilian Portuguese: “Carga horária”.",
      message: "Study time",
    }),
    value: t({
      description:
        "A certificate's study time, the plan's estimate for the lessons studied, such as “about 41 hr”. Brazilian schools read it as the certificate's workload (carga horária).",
      message: "about {duration}",
      values: { duration: formatStudyTime({ locale, minutes }) },
    }),
  };

  return [completed, studied, testedOut, studyTime].filter((fact) => fact !== false);
}

export async function getStudyStats({ facts, locale }: KindInput): Promise<CertificateStat[]> {
  const t = await getExtracted({ locale });
  const { lessonsStudied, minutes } = getShownStudyCounts(facts);

  const lessons = lessonsStudied !== null && {
    label: t({
      description:
        "Under a big number on a certificate's social post: how many lessons the learner studied.",
      message: "{count, plural, =0 {lessons studied} one {lesson studied} other {lessons studied}}",
      values: { count: lessonsStudied },
    }),
    unit: "",
    value: formatCount({ count: lessonsStudied, locale }),
  };

  const studyTime = minutes !== null && {
    ...getStudyTimeStat({ locale, minutes }),
    label: t({
      description:
        "Under a big number of hours on a certificate's social post, such as “~41 h” over “of study”.",
      message: "of study",
    }),
  };

  return [lessons, studyTime].filter((stat) => stat !== false);
}
