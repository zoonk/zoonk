import { listSubjectGroups } from "@zoonk/utils/exam-groups";
import { normalizeString } from "@zoonk/utils/string";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { namesMatch } from "../_utils/name-match";

function sumKnown(values: readonly (number | null)[]): number | null {
  return values.length > 0 && values.every((value) => value !== null)
    ? values.reduce<number>((total, value) => total + (value ?? 0), 0)
    : null;
}

/** The tests or blocks the learner's words name as a whole, such as an exam's first phase; empty when any word names something else. */
export function listNamedParts({
  examSubjects,
  structure,
}: {
  examSubjects: readonly string[];
  structure: ExamStructure;
}): string[] {
  const groups = [...new Set(structure.subjects.flatMap((subject) => listSubjectGroups(subject)))];
  const named = (said: string) => groups.find((group) => normalizeString(group) === said);
  const parts = examSubjects.map((said) => named(normalizeString(said)));

  return parts.every((part) => part !== undefined) ? [...new Set(parts)] : [];
}

type Subject = ExamStructure["subjects"][number];

/** A subject of the kept parts names only those parts, so a part left out can't count it. */
function keepPartGroups({
  parts,
  subject,
}: {
  parts: readonly string[];
  subject: Subject;
}): Subject {
  const [group, ...others] = listSubjectGroups(subject).filter((name) => parts.includes(name));
  const { otherGroups: _others, ...rest } = subject;

  return {
    ...rest,
    group: group ?? subject.group ?? null,
    ...(others.length > 0 && { otherGroups: others }),
  };
}

/**
 * A part the learner prepares as a whole keeps its own sittings and scoring, so a first phase's
 * mock still asks its questions and judges its minimum. Null when no sitting names the part.
 */
export function scopeToParts({
  kept,
  parts,
  structure,
}: {
  kept: ReadonlySet<string>;
  parts: readonly string[];
  structure: ExamStructure;
}): ExamStructure | null {
  const { mock } = structure;

  const sections = (mock?.sections ?? []).filter((section) =>
    parts.some((part) => namesMatch(part, section.name)),
  );

  if (!mock || sections.length === 0) {
    return null;
  }

  const { finalShares: _shares, ...scoring } = mock.scoring;
  const scored = scoring.parts?.filter((part) => parts.includes(part.name));

  return {
    ...structure,
    mock: {
      ...mock,
      scoring: {
        ...scoring,
        marking: scoring.marking?.filter((row) => row.part === null || parts.includes(row.part)),
        parts: scored,
        totalMinimum: null,
      },
      sections,
      timeLimitMinutes: sumKnown(sections.map((section) => section.minutes)),
      totalQuestions:
        sumKnown(sections.map((section) => section.questions)) ??
        sumKnown((scored ?? []).map((part) => part.questions)),
    },
    subjects: structure.subjects
      .filter((subject) => kept.has(subject.name))
      .map((subject) => keepPartGroups({ parts, subject })),
  };
}
