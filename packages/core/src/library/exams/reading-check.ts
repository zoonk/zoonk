import { type ExamReadingFindings } from "@zoonk/ai/tasks/v2/research/check-exam-reading";
import { type ReadingCorrection } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { type ExamBlueprint } from "@zoonk/db";
import { nameOverlap, namesMatch } from "../../exams/_utils/name-match";
import { listCountedSubjects } from "../../exams/choices/exam-choices";
import { isWrittenSubject } from "../../exams/mocks/written-subject";
import {
  type BlueprintContent,
  type ReadingProblem,
  examEditionSchema,
} from "./blueprint-contract";
import { type ExtractionDocument } from "./blueprint-passages";
import { isPassageInDocument } from "./passage-check";

/**
 * How many times one document is read while its reading keeps problems: research reads it at most
 * twice per request (a reading, then one told what the check found), so a notice whose problems
 * stay is read again on one more request, never on every one, until the notice itself changes.
 */
const MAX_READINGS = 4;

/** Below this share of shared words, two names are different subjects that share a word. */
const MIN_OVERLAP = 0.5;

type Subject = BlueprintContent["structure"]["subjects"][number];

function isNamed({ name, subject }: { name: string; subject: Subject }): boolean {
  return [subject.name, subject.shortName].some(
    (other) => other && (namesMatch(name, other) || nameOverlap(name, other) > MIN_OVERLAP),
  );
}

function findSubject({ content, name }: { content: BlueprintContent; name: string }) {
  return content.structure.subjects.find((subject) => isNamed({ name, subject }));
}

/** A finding's passage, as a citation, when code finds it in its document. */
function toCitation({
  documents,
  finding,
}: {
  documents: readonly ExtractionDocument[];
  finding: { document: number; passage: string };
}) {
  const document = documents[finding.document - 1];

  return document?.text && isPassageInDocument({ passage: finding.passage, text: document.text })
    ? { passage: finding.passage, sourceId: document.sourceId }
    : null;
}

function hasNumber({ passage, questions }: { passage: string; questions: number }): boolean {
  return new RegExp(`(?<!\\d)${questions}(?!\\d)`, "u").test(passage);
}

function toMissingSubjects({
  content,
  documents,
  findings,
}: {
  content: BlueprintContent;
  documents: readonly ExtractionDocument[];
  findings: ExamReadingFindings;
}): ReadingProblem[] {
  return findings.missingSubjects.flatMap((finding) => {
    const citation = toCitation({ documents, finding });

    return citation && !findSubject({ content, name: finding.name })
      ? [{ citation, kind: "missingSubject" as const, name: finding.name }]
      : [];
  });
}

function toMissingCounts({
  checked,
  content,
  documents,
  findings,
}: {
  checked: readonly { name: string }[];
  content: BlueprintContent;
  documents: readonly ExtractionDocument[];
  findings: ExamReadingFindings;
}): ReadingProblem[] {
  return findings.statedCounts.flatMap((finding) => {
    const name = checked[finding.subject - 1]?.name;
    const subject = name ? findSubject({ content, name }) : undefined;
    const citation = toCitation({ documents, finding });

    if (!subject || !citation || subject.questions === finding.questions) {
      return [];
    }

    return hasNumber({ passage: finding.passage, questions: finding.questions })
      ? [
          {
            citation,
            kind: "missingCount" as const,
            questions: finding.questions,
            subject: subject.name,
          },
        ]
      : [];
  });
}

/**
 * Objective subjects whose notice counts don't add up to the exam's questions, when every one has
 * a count and the exam's total is known: one of them was misread. A choice counts once and an option
 * counted inside another subject not again (`listCountedSubjects`).
 */
function findTotalProblems(content: BlueprintContent): ReadingProblem[] {
  const { edition, structure } = content;
  const total = structure.mock?.totalQuestions ?? edition.questionCount;

  const objective = listCountedSubjects(structure.subjects).filter(
    (subject) => !isWrittenSubject({ structure, subject }),
  );

  const counts = objective.map((subject) => subject.questions);

  if (total === null || counts.length === 0 || counts.includes(null)) {
    return [];
  }

  const sum = counts.reduce<number>((all, count) => all + (count ?? 0), 0);
  return sum === total ? [] : [{ kind: "countsOffTotal", sum, total }];
}

/** What a reading stated, as `findUnconfirmed` compares it with what the checks kept. */
type ReadFacts = {
  dates: readonly { kind: string }[];
  mock: { scoring: { scale?: object | null } } | null;
  subjects: readonly { name: string; topics: readonly string[] }[];
};

function hasExamDate(dates: readonly { kind: string }[]): boolean {
  return dates.some((date) => date.kind === "exam");
}

/**
 * What the reading stated that no check kept from the passages it quoted: the scale the result is
 * reported on (the cut-off's scale), the exam's day, and a kept syllabus subject's topics, none of
 * which its documents state word for word. TJ-SP's reading lost all three: its mock quoted no line with
 * the scale, its date's label said more than the passage, and it numbered an unnumbered syllabus.
 */
function findUnconfirmed({ content, read }: { content: BlueprintContent; read: ReadFacts }) {
  const { edition, structure } = content;
  const problems: ReadingProblem[] = [];

  if (read.mock?.scoring.scale && !structure.mock?.scoring.scale) {
    problems.push({ kind: "unconfirmed", part: "scale", subject: null });
  }

  if (hasExamDate(read.dates) && !hasExamDate(edition.dates)) {
    problems.push({ kind: "unconfirmed", part: "examDate", subject: null });
  }

  // A written test's topics are the themes it asks, in the reading's words, not a syllabus's items.
  const topicless = read.subjects.filter(
    (subject) =>
      subject.topics.length > 0 &&
      structure.subjects.some(
        (kept) =>
          kept.name === subject.name &&
          kept.topics.length === 0 &&
          !isWrittenSubject({ structure, subject: kept }),
      ),
  );

  return [
    ...problems,
    ...topicless.map((subject) => ({
      kind: "unconfirmed" as const,
      part: "topics" as const,
      subject: subject.name,
    })),
  ];
}

/**
 * What a reading left out of its documents, from the check's findings (`checkExamReading`) on the
 * subjects it was given (`checked`, in its numbering) and from code: a subject the documents name
 * as part of the exam that no stored subject is, a subject's count they state that the stored
 * subject lacks, counts that don't add up to the exam's questions and, given the reading itself
 * (`read`), what it stated that no check kept (`findUnconfirmed`). A finding counts only when code
 * finds its passage in its document, and a "missing" subject the reading has under another name
 * doesn't count: a wrong finding only costs a reading, but it costs it every time.
 */
export function findReadingProblems({
  checked,
  content,
  documents,
  findings,
  read,
}: {
  checked: readonly { name: string }[];
  content: BlueprintContent;
  documents: readonly ExtractionDocument[];
  findings: ExamReadingFindings;
  read?: ReadFacts;
}): ReadingProblem[] {
  return [
    ...toMissingSubjects({ content, documents, findings }),
    ...toMissingCounts({ checked, content, documents, findings }),
    ...findTotalProblems(content),
    ...(read ? findUnconfirmed({ content, read }) : []),
  ];
}

/**
 * A problem as a reading again is told it (`ReadingCorrection`): a passage by the number of the
 * document it's in, among `documents` in the order the reading got them. Nothing for a passage in
 * a document the reading doesn't have.
 */
export function toReadingCorrections({
  documents,
  problem,
}: {
  documents: readonly Pick<ExtractionDocument, "sourceId">[];
  problem: ReadingProblem;
}): ReadingCorrection[] {
  if (problem.kind === "countsOffTotal" || problem.kind === "unconfirmed") {
    return [problem];
  }

  const document = documents.findIndex((item) => item.sourceId === problem.citation.sourceId) + 1;

  if (document === 0) {
    return [];
  }

  return problem.kind === "missingSubject"
    ? [{ document, kind: problem.kind, name: problem.name, passage: problem.citation.passage }]
    : [
        {
          document,
          kind: problem.kind,
          passage: problem.citation.passage,
          questions: problem.questions,
          subject: problem.subject,
        },
      ];
}

/** A reading's problems; a reading its check couldn't check (null) counts as worse than any. */
function countProblems(problems: readonly ReadingProblem[] | null): number {
  return problems?.length ?? Number.POSITIVE_INFINITY;
}

/**
 * Of two readings of the same documents, the one whose check found fewer problems; the later one
 * on a tie, since it was told what the first one left out.
 */
export function pickBetterReading<T extends { problems: readonly ReadingProblem[] | null }>({
  first,
  second,
}: {
  first: T;
  second: T;
}): T {
  return countProblems(second.problems) <= countProblems(first.problems) ? second : first;
}

/** Whether a document read `readings` times may be read again while its reading has problems. */
export function canReadAgain(readings: number): boolean {
  return readings < MAX_READINGS;
}

/**
 * How a stored reading stands: `readAgain` with what its check found, while that check found
 * problems and the document may still be read again; `settled` otherwise (a learner's own
 * material, which isn't checked, a check that found no problem, a document read as many times as
 * it may be, or a reading with no check at all, stored before readings were checked or whose check
 * failed): a reading is never read again for a code or prompt change, only for problems found.
 */
export function getReadingStatus(
  blueprint: Pick<ExamBlueprint, "edition" | "ownerId" | "sourceId">,
): { status: "settled" } | { problems: ReadingProblem[]; readings: number; status: "readAgain" } {
  if (blueprint.ownerId || !blueprint.sourceId) {
    return { status: "settled" };
  }

  const check = examEditionSchema.safeParse(blueprint.edition).data?.check;

  return check && check.problems.length > 0 && canReadAgain(check.readings)
    ? { problems: check.problems, readings: check.readings, status: "readAgain" }
    : { status: "settled" };
}
