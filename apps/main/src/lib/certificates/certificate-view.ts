import "server-only";
import { getCategoryNames } from "@/lib/categories/category";
import { getLevelLabels } from "@/lib/public/public-labels";
import { type CertificateFacts, type CertifiedLevel } from "@zoonk/core/certificates/contract";
import { getCertificateDisplayUrl, getCertificateLinks } from "@zoonk/utils/certificate-links";
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
  getSkillReadouts,
  getSkillStats,
  getStudyFacts,
  getStudyStats,
} from "./certificate-study-view";
import { type TextRun } from "./shaped-text";

const NEXT_BAND: Record<CertifiedLevel, string> = {
  A1: "A2",
  A2: "B1",
  B1: "B2",
  B2: "C1",
  C1: "C2",
};

export type CertificateGraph =
  | { kind: "ladder"; filled: number; reached: string | null }
  | { kind: "route"; topics: number; zones: { chapters: number; label: string }[] };

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
  covered:
    | { kind: "readouts"; readouts: Readout[] }
    | { kind: "topics"; label: string; topics: string[]; total: number }
    | null;
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

/** What a certificate certifies, in one line: the course title, or "Spanish B1". */
export function getCertificateFileTitle(facts: CertificateFacts): string {
  return getTitleRuns(facts)
    .map((run) => run.text)
    .join("");
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

  const [t, readouts, studyFacts, studyStats] = await Promise.all([
    getExtracted({ locale }),
    getSkillReadouts(input),
    getStudyFacts(input),
    getStudyStats(input),
  ]);

  return {
    covered: readouts.length > 0 ? { kind: "readouts", readouts } : null,
    facts: studyFacts,
    finePrint: t({
      description:
        "The fine print on a language level certificate. {level} is the next level's start, such as B2 on a B1 certificate.",
      message:
        "Awarded when every skill this learner practiced on Zoonk reached {level}, measured from their answers. This is not an official exam result.",
      values: { level: facts.level ? NEXT_BAND[facts.level] : "" },
    }),
    graph: { filled: getLadderFill(facts.level), kind: "ladder", reached: facts.level },
    meta: t({
      description:
        "How a language level certificate was earned. The level follows the CEFR scale, without claiming official recognition.",
      message: "Level completed · aligned with the CEFR",
    }),
    stats: studyStats.length > 0 ? studyStats : getSkillStats(readouts),
    subject: null,
  };
}

/** "Beginner to Advanced · 36 chapters", or "Beginner level · 12 chapters" for one level. */
async function getCourseMeta({
  locale,
  zones,
}: {
  locale: string;
  zones: { chapters: number; label: string; level: string }[];
}): Promise<string> {
  const t = await getExtracted({ locale });
  const [first] = zones;
  const last = zones.at(-1);
  const chapters = zones.reduce((sum, zone) => sum + zone.chapters, 0);

  const oneLevel =
    first &&
    t({
      description:
        "A course certificate's span when the plan held one level, such as “Beginner level”.",
      message: "{level} level",
      values: { level: first.label },
    });

  const levels =
    first &&
    last &&
    t({
      description:
        "The span of levels a course certificate covers, such as “Beginner to Advanced”. Reword both ends as your language says a range of course levels, such as Portuguese “Do iniciante ao avançado”.",
      message:
        "{from, select, overview {Overview} beginner {Beginner} intermediate {Intermediate} other {Advanced}} to {to, select, overview {Overview} beginner {Beginner} intermediate {Intermediate} other {Advanced}}",
      values: { from: first.level, to: last.level },
    });

  const chapterCount =
    chapters > 0 &&
    t({
      description: "How many chapters a finished course's plan held.",
      message: "{count, plural, one {# chapter} other {# chapters}}",
      values: { count: chapters },
    });

  return [zones.length === 1 ? oneLevel : levels, chapterCount].filter(Boolean).join(" · ");
}

async function getCourseView(input: KindInput): Promise<KindView> {
  const { facts, locale } = input;

  const zones = await getLevelLabels(locale).then((levelLabels) =>
    facts.courseLevels.map((courseLevel) => ({
      chapters: courseLevel.chapters,
      label: levelLabels[courseLevel.level],
      level: courseLevel.level,
    })),
  );

  const [t, categoryNames, studyFacts, stats, meta] = await Promise.all([
    getExtracted({ locale }),
    getCategoryNames(locale),
    getStudyFacts(input),
    getStudyStats(input),
    getCourseMeta({ locale, zones }),
  ]);

  const shown = getShownTopics(facts.topics);

  const label = t({
    description: "Above the topics a finished course covered, on its certificate.",
    message: "Topics covered",
  });

  return {
    covered:
      shown.length > 0
        ? { kind: "topics", label, topics: shown, total: facts.topics.length }
        : null,
    facts: studyFacts,
    finePrint: t({
      description: "The fine print on a course certificate.",
      message: "Awarded for finishing every lesson and challenge of this course on Zoonk.",
    }),
    graph: { kind: "route", topics: facts.topics.length, zones },
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
