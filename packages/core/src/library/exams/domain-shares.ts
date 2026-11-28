import {
  type DomainShareFinding,
  type DomainShareSubject,
} from "@zoonk/ai/tasks/research/find-domain-shares";
import { normalizeString } from "@zoonk/utils/string";
import { type BlueprintContent, type BlueprintTopicGroup } from "./blueprint-contract";
import { type ExtractionDocument } from "./blueprint-passages";
import { findNamesInDocument, isPassageInDocument } from "./passage-check";

type Subject = BlueprintContent["structure"]["subjects"][number];
type Range = { max: number; min: number };

/** How far stated percentages may miss 100 together, since each is rounded ("≈26%"). */
const PERCENT_SLACK = 5;
const WHOLE = 100;

/** A share needs headings to split between. */
const MIN_HEADINGS = 2;

type CheckedShare = {
  basis: NonNullable<BlueprintTopicGroup["basis"]>;
  citation: NonNullable<BlueprintTopicGroup["citation"]>;
  percent: Range | null;
  questions: Range | null;
};

function hasHeadings(subject: Subject): boolean {
  return (subject.topicGroups?.length ?? 0) >= MIN_HEADINGS;
}

/** The subjects whose headings a share could split, numbered as the read numbers them. */
export function listShareSubjects(content: BlueprintContent): DomainShareSubject[] {
  return content.structure.subjects
    .filter((subject) => hasHeadings(subject))
    .map((subject) => ({
      headings: (subject.topicGroups ?? []).map((group) => group.name),
      name: subject.name,
    }));
}

function hasNumber({ passage, value }: { passage: string; value: number }): boolean {
  const written = String(value).replace(".", "[.,]");
  return new RegExp(`(?<![\\d.,])${written}(?![\\d]|[.,]\\d)`, "u").test(passage);
}

function toStatedRange({ passage, range }: { passage: string; range: Range | null }) {
  const isStated =
    range !== null &&
    range.min >= 0 &&
    range.min <= range.max &&
    hasNumber({ passage, value: range.min }) &&
    hasNumber({ passage, value: range.max });

  return isStated ? range : null;
}

function toCheckedShare({
  documents,
  finding,
}: {
  documents: readonly ExtractionDocument[];
  finding: DomainShareFinding;
}): CheckedShare | null {
  const document = documents[finding.document - 1];
  const { passage } = finding;

  const isQuoted =
    document?.text &&
    isPassageInDocument({ passage, text: document.text }) &&
    findNamesInDocument({ names: [finding.heading], text: passage }).size > 0;

  if (!isQuoted) {
    return null;
  }

  const percent = toStatedRange({ passage, range: finding.percent });
  const questions = toStatedRange({ passage, range: finding.questions });

  return percent || questions
    ? {
        basis: finding.basis,
        citation: { passage, sourceId: document.sourceId },
        percent,
        questions,
      }
    : null;
}

function midpoint(range: Range): number {
  return (range.min + range.max) / 2;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function fitsWhole(percents: readonly Range[]): boolean {
  const low = sum(percents.map((range) => range.min)) - PERCENT_SLACK;
  const high = sum(percents.map((range) => range.max)) + PERCENT_SLACK;
  return low <= WHOLE && WHOLE <= high;
}

function fitsCount({ counts, total }: { counts: readonly Range[]; total: number | null }): boolean {
  return (
    total === null ||
    (sum(counts.map((range) => range.min)) <= total &&
      total <= sum(counts.map((range) => range.max)))
  );
}

type Scale = "percent" | "questions";

/**
 * Percentages when every heading has one, else question counts; null unless the whole subject is
 * covered one way, on one basis, and the numbers fit it.
 */
function chooseScale({
  shares,
  subject,
}: {
  shares: readonly CheckedShare[];
  subject: Subject;
}): Scale | null {
  if (new Set(shares.map((share) => share.basis)).size !== 1) {
    return null;
  }

  const percents = shares.flatMap((share) => (share.percent ? [share.percent] : []));
  const counts = shares.flatMap((share) => (share.questions ? [share.questions] : []));

  if (percents.length === shares.length) {
    return fitsWhole(percents) ? "percent" : null;
  }

  if (counts.length === shares.length) {
    return fitsCount({ counts, total: subject.questions }) ? "questions" : null;
  }

  return null;
}

function toWeight({ scale, share }: { scale: Scale; share: CheckedShare }): number {
  const range = scale === "percent" ? share.percent : share.questions;
  return range ? midpoint(range) : 0;
}

function findShare({
  checked,
  group,
  subjectNumber,
}: {
  checked: readonly { share: CheckedShare; finding: DomainShareFinding }[];
  group: BlueprintTopicGroup;
  subjectNumber: number;
}): CheckedShare | null {
  const name = normalizeString(group.name);

  return (
    checked.find(
      ({ finding }) =>
        finding.subject === subjectNumber && normalizeString(finding.heading) === name,
    )?.share ?? null
  );
}

function withShares({
  checked,
  subject,
  subjectNumber,
}: {
  checked: readonly { share: CheckedShare; finding: DomainShareFinding }[];
  subject: Subject;
  subjectNumber: number;
}): Subject {
  const groups = subject.topicGroups ?? [];

  const found = groups.flatMap((group) => {
    const share = findShare({ checked, group, subjectNumber });
    return share ? [{ group, share }] : [];
  });

  const scale =
    found.length === groups.length
      ? chooseScale({ shares: found.map((item) => item.share), subject })
      : null;

  const weighted = scale
    ? found.map((item) => ({ ...item, weight: toWeight({ scale, share: item.share }) }))
    : [];

  const total = sum(weighted.map((item) => item.weight));

  if (weighted.length === 0 || total <= 0) {
    return subject;
  }

  return {
    ...subject,
    topicGroups: weighted.map(({ group, share, weight }) => ({
      ...group,
      basis: share.basis,
      citation: share.citation,
      ...(share.questions && { questions: share.questions }),
      share: weight / total,
    })),
  };
}

/**
 * Takes the read shares a subject's every heading has, each checked against the passage it quotes,
 * as midpoints of their ranges normalized within the subject. A subject left partly covered keeps
 * its headings without shares.
 */
export function applyDomainShares({
  content,
  documents,
  findings,
}: {
  content: BlueprintContent;
  documents: readonly ExtractionDocument[];
  findings: readonly DomainShareFinding[];
}): BlueprintContent {
  const checked = findings.flatMap((finding) => {
    const share = toCheckedShare({ documents, finding });
    return share ? [{ finding, share }] : [];
  });

  const numbered = content.structure.subjects.filter((subject) => hasHeadings(subject));

  return {
    ...content,
    structure: {
      ...content.structure,
      subjects: content.structure.subjects.map((subject) => {
        const subjectNumber = numbered.indexOf(subject) + 1;
        return subjectNumber > 0 ? withShares({ checked, subject, subjectNumber }) : subject;
      }),
    },
  };
}
