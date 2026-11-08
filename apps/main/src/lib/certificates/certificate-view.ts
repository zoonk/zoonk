import "server-only";
import { getCategoryNames } from "@/lib/categories/category";
import { type CertificateFacts } from "@zoonk/core/certificates/contract";
import { getCertificateDisplayUrl, getCertificateLinks } from "@zoonk/utils/certificate-links";
import { getCourseLevelNames } from "@zoonk/utils/course-level-names";
import { getLanguageName } from "@zoonk/utils/languages";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { getBaseUrl } from "@zoonk/utils/origin";
import { getExtracted } from "next-intl/server";
import { formatCertificateDate, getLadderFill, getShownTopics } from "./certificate-format";
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
export type CertificateGraph =
  | { kind: "ladder"; filled: number; reached: string | null }
  | { kind: "route"; label: string | null; stations: number };

type CommonView = {
  date: string;
  displayUrl: string;
  kindLabel: string;
  name: { isPlaceholder: boolean; text: string };
  qrUrl: string;
  title: TextRun[];
  verifyLabel: string;
};

type KindView = {
  covered: { label: string; topics: string[]; total: number } | null;
  facts: Readout[];
  finePrint: string;
  graph: CertificateGraph;
  meta: string;
  stats: CertificateStat[];
  subject: { label: string; text: string; tint: string } | null;
};

export type CertificateView = CommonView & KindView;

function getTargetLanguageName(facts: CertificateFacts): string {
  return facts.targetLanguage
    ? getLanguageName({ targetLanguage: facts.targetLanguage, userLanguage: facts.language })
    : "";
}

function getTitleRuns(facts: CertificateFacts): TextRun[] {
  if (facts.kind === "course") {
    return [{ color: CERTIFICATE_COLORS.ink, text: facts.title ?? "" }];
  }

  return [
    { color: CERTIFICATE_COLORS.ink, text: `${getTargetLanguageName(facts)} ` },
    { color: CERTIFICATE_COLORS.successText, text: facts.level ?? "" },
  ];
}

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
    title: getTitleRuns(facts),
    verifyLabel: t({
      description:
        "Above a certificate's link and QR code, which open the page that proves it's real.",
      message: "Verify this certificate",
    }),
  };
}

async function getLanguageLevelView(input: KindInput): Promise<KindView> {
  const { facts, locale } = input;

  const [t, studyFacts, stats] = await Promise.all([
    getExtracted({ locale }),
    getStudyFacts(input),
    getStudyStats(input),
  ]);

  return {
    covered: null,
    facts: studyFacts,
    finePrint: t({
      description: "The fine print on a language level certificate, such as B1.",
      message: "Awarded for finishing this level on Zoonk. This is not an official exam result.",
    }),
    graph: { filled: getLadderFill(facts.level), kind: "ladder", reached: facts.level },
    meta: t({
      description:
        "How a language level certificate was earned. The level follows the CEFR scale, without claiming official recognition.",
      message: "Level completed · aligned with the CEFR",
    }),
    stats,
    subject: null,
  };
}

/** "Beginner level · 12 chapters" on a level's certificate, "12 chapters" on a plan's. */
async function getCourseMeta({
  level,
  locale,
  topics,
}: {
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

  return [levelLine, chapterCount].filter(Boolean).join(" · ");
}

async function getCourseView(input: KindInput): Promise<KindView> {
  const { facts, locale } = input;

  const level = facts.courseLevel && getCourseLevelNames(facts.language)[facts.courseLevel];
  const topics = facts.topics.length;

  const [t, categoryNames, studyFacts, stats, meta] = await Promise.all([
    getExtracted({ locale }),
    getCategoryNames(locale),
    getStudyFacts(input),
    getStudyStats(input),
    getCourseMeta({ level, locale, topics }),
  ]);

  const shown = getShownTopics(facts.topics);

  const label = t({
    description: "Above the topics a finished course covered, on its certificate.",
    message: "Topics covered",
  });

  return {
    covered: shown.length > 0 ? { label, topics: shown, total: facts.topics.length } : null,
    facts: studyFacts,
    finePrint: level
      ? t({
          description: "The fine print on a course level's certificate.",
          message: "Awarded for finishing every lesson and challenge of this level on Zoonk.",
        })
      : t({
          description:
            "The fine print on a certificate for a learner's whole study plan in a course, which may cover only part of the course: the topics it lists.",
          message: "Awarded for finishing every lesson and challenge of a study plan on Zoonk.",
        }),
    graph: { kind: "route", label: level, stations: topics },
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

  const [common, kindView] = await Promise.all([
    getCommonView(input),
    facts.kind === "course" ? getCourseView(input) : getLanguageLevelView(input),
  ]);

  return { ...common, ...kindView };
}
