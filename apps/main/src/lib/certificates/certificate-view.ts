import "server-only";
import { getCategoryNames } from "@/lib/categories/category";
import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import {
  getCertificateDisplayUrl,
  getCertificateLevelName,
  getCertificateLinks,
} from "@zoonk/utils/certificate-links";
import { getCourseLevelNames } from "@zoonk/utils/course-level-names";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { getBaseUrl } from "@zoonk/utils/origin";
import { getExtracted } from "next-intl/server";
import { formatCertificateDate, getShownTopics } from "./certificate-format";
import { CERTIFICATE_COLORS, SUBJECT_COLORS } from "./certificate-palette";
import {
  type CertificateStat,
  type KindInput,
  type Readout,
  getStudyFacts,
  getStudyStats,
} from "./certificate-study-view";
import { type TextRun } from "./shaped-text";

/** A course's route has a station per topic, labelled with its level on a level's certificate. */
type CertificateGraph = { label: string | null; stations: number };

type CommonView = {
  date: string;
  displayUrl: string;
  kindLabel: string;
  name: { isPlaceholder: boolean; text: string };
  qrUrl: string;
  title: TextRun[];
  verifyLabel: string;
};

type CourseView = {
  covered: { label: string; topics: string[]; total: number } | null;
  facts: Readout[];
  finePrint: string;
  graph: CertificateGraph;
  meta: string;
  stats: CertificateStat[];
  subject: { label: string; text: string; tint: string } | null;
};

export type CertificateView = CommonView & CourseView;

async function getCommonView({ facts, locale }: KindInput): Promise<CommonView> {
  const t = await getExtracted({ locale });
  const links = getCertificateLinks({ ...facts, origin: getBaseUrl() });

  const placeholder = t({
    description:
      "Shown on a certificate where the learner's name goes, until they add one to their profile.",
    message: "Your name",
  });

  return {
    date: formatCertificateDate({ isoDate: facts.completedOn, locale }),
    displayUrl: getCertificateDisplayUrl(links.url),
    kindLabel: t({
      description: "The kind of document, above the learner's name on a certificate.",
      message: "Certificate of completion",
    }),
    name: facts.recipientName
      ? { isPlaceholder: false, text: facts.recipientName }
      : { isPlaceholder: true, text: placeholder },
    qrUrl: links.url,
    title: [{ color: CERTIFICATE_COLORS.ink, text: facts.title }],
    verifyLabel: t({
      description:
        "Above a certificate's link and QR code, which open the page that proves it's real.",
      message: "Verify this certificate",
    }),
  };
}

/**
 * "Beginner level · 12 chapters" on a level's certificate, "Intermediate level · B1–B2 · 12
 * chapters" on a language course's, "12 chapters" on a plan's.
 */
async function getCourseMeta({
  cefrRange,
  level,
  locale,
  topics,
}: {
  cefrRange: string | null;
  level: string | null;
  locale: string;
  topics: number;
}): Promise<string> {
  const t = await getExtracted({ locale });

  const levelLine =
    level &&
    t({
      description: "A course level certificate's level, such as “Beginner level”.",
      message: "{level} level",
      values: { level },
    });

  const chapterCount =
    topics > 0 &&
    t({
      description: "How many chapters a finished course's plan held.",
      message: "{count, plural, one {# chapter} other {# chapters}}",
      values: { count: topics },
    });

  return [levelLine, cefrRange, chapterCount].filter(Boolean).join(" · ");
}

async function getFinePrint({ facts, locale }: KindInput): Promise<string> {
  const t = await getExtracted({ locale });

  if (facts.cefrRange) {
    return t({
      description:
        "The fine print on a language course level's certificate, such as Italian · Intermediate (B1–B2), under the facts that show how many lessons were studied and passed by test. The CEFR is the Common European Framework of Reference for Languages: keep the acronym “CEFR”, as the certificate's page does, and say the levels follow it rather than that they are CEFR levels. Anyone the learner shares it with reads it, so don't address the reader. Keep it under 95 characters, or 50 in Japanese or Korean: it has one line on the certificate, and a longer one pushes the topics off it.",
      message:
        "At least half its lessons studied. Levels follow the CEFR; not an official exam result.",
    });
  }

  return facts.courseLevel
    ? t({
        description:
          "The fine print on a course level's certificate, under the facts that show how many lessons were studied and passed by test. Anyone the learner shares it with reads it, so don't address the reader. Keep it under 95 characters, or 50 in Japanese or Korean: it has one line on the certificate, and a longer one pushes the topics off it.",
        message:
          "Awarded for finishing this level on Zoonk, with at least half its lessons studied.",
      })
    : t({
        description:
          "The fine print on a certificate for a learner's whole study plan in a course, which may cover only part of the course: the topics it lists. Anyone the learner shares it with reads it, so don't address the reader. Keep it under 95 characters, or 50 in Japanese or Korean: it has one line on the certificate, and a longer one pushes the topics off it.",
        message:
          "Awarded for finishing a study plan on Zoonk, with at least half its lessons studied.",
      });
}

async function getCourseView(input: KindInput): Promise<CourseView> {
  const { facts, locale } = input;
  const { cefrRange, courseLevel, language } = facts;
  const level = courseLevel && getCourseLevelNames(language)[courseLevel];
  const topics = facts.topics.length;

  const [t, categoryNames, studyFacts, stats, meta, finePrint] = await Promise.all([
    getExtracted({ locale }),
    getCategoryNames(locale),
    getStudyFacts(input),
    getStudyStats(input),
    getCourseMeta({ cefrRange, level, locale, topics }),
    getFinePrint(input),
  ]);

  const shown = getShownTopics(facts.topics);

  const label = t({
    description: "Above the topics a finished course covered, on its certificate.",
    message: "Topics covered",
  });

  return {
    covered: shown.length > 0 ? { label, topics: shown, total: facts.topics.length } : null,
    facts: studyFacts,
    finePrint,
    graph: {
      label: courseLevel && getCertificateLevelName({ cefrRange, courseLevel, language }),
      stations: topics,
    },
    meta,
    stats,
    subject: facts.category
      ? { label: categoryNames[facts.category] ?? "", ...SUBJECT_COLORS[facts.category] }
      : null,
  };
}

/** Every word on a certificate, in its own language: Satori draws synchronous components. */
export async function getCertificateView(facts: CertificateFacts): Promise<CertificateView> {
  const input = { facts, locale: getSupportedLocaleFromLanguage(facts.language) };

  const [common, course] = await Promise.all([getCommonView(input), getCourseView(input)]);

  return { ...common, ...course };
}
