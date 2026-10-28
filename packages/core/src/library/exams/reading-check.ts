import { type ExamReadingFindings } from "@zoonk/ai/tasks/v2/research/check-exam-reading";
import { type ReadingCorrection } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { nameOverlap, namesMatch } from "../../exams/_utils/name-match";
import { listCountedSubjects } from "../../exams/choices/exam-choices";
import { isWrittenSubject } from "../../exams/mocks/written-subject";
import { type BlueprintContent, type ReadingProblem } from "./blueprint-contract";
import { type ExtractionDocument } from "./blueprint-passages";
import { isPassageInDocument } from "./passage-check";

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

type ReadFacts = {
  dates: readonly { kind: string }[];
  mock: { scoring: { scale?: object | null } } | null;
  subjects: readonly { name: string; topics: readonly string[] }[];
};

function hasExamDate(dates: readonly { kind: string }[]): boolean {
  return dates.some((date) => date.kind === "exam");
}

function findUnconfirmed({ content, read }: { content: BlueprintContent; read: ReadFacts }) {
  const { edition, structure } = content;
  const problems: ReadingProblem[] = [];

  if (read.mock?.scoring.scale && !structure.mock?.scoring.scale) {
    problems.push({ kind: "unconfirmed", part: "scale", subject: null });
  }

  if (hasExamDate(read.dates) && !hasExamDate(edition.dates)) {
    problems.push({ kind: "unconfirmed", part: "examDate", subject: null });
  }

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
