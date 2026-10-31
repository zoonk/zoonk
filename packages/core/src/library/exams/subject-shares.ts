import { getSubjectShareFallback } from "../../exams/_utils/subject-share-fallback";
import { listCountedSubjects } from "../../exams/choices/exam-choices";
import { type ExamStructure, type ScoredPart } from "./blueprint-contract";
import { getPartMaxPoints } from "./part-points";
import { getSubjectPoints } from "./subject-points";

type Subject = ExamStructure["subjects"][number];

const PERCENT = 100;

type ShareGroup = { parts: readonly string[]; share: number };

function isInGroup({ group, subject }: { group: ShareGroup; subject: Subject }): boolean {
  return [subject.name, subject.group, subject.partOf].some(
    (name) => typeof name === "string" && group.parts.includes(name),
  );
}

function findQualifyingPart({
  structure,
  subject,
}: {
  structure: ExamStructure;
  subject: Subject;
}): ScoredPart | null {
  const parts = structure.mock?.scoring.parts ?? [];

  return (
    parts.find(
      (part) => part.qualifying && (part.name === subject.name || part.name === subject.group),
    ) ?? null
  );
}

function isQualifying({ structure, subject }: { structure: ExamStructure; subject: Subject }) {
  return findQualifyingPart({ structure, subject }) !== null;
}

/** The share of its points a test's minimum asks; all of them when the notice gives none. */
function getPassShare({ part, structure }: { part: ScoredPart; structure: ExamStructure }) {
  const { minimum } = part;

  if (!minimum) {
    return 1;
  }

  if (minimum.unit === "percent") {
    return Math.min(1, minimum.value / PERCENT);
  }

  const max = getPartMaxPoints({ marking: structure.mock?.scoring.marking ?? [], part });
  return max ? Math.min(1, minimum.value / max) : 1;
}

/** A subject's own stated weight counts only where no term of the final score covers it. */
function listShareGroups(structure: ExamStructure): ShareGroup[] {
  const terms = structure.mock?.scoring.finalShares ?? [];

  const own = structure.subjects.flatMap((subject) =>
    subject.weight !== null && !terms.some((group) => isInGroup({ group, subject }))
      ? [{ parts: [subject.name], share: subject.weight }]
      : [],
  );

  return [...terms, ...own];
}

function getShareInGroup({
  members,
  points,
  share,
  stated,
  subject,
}: {
  members: readonly Subject[];
  points: ReadonlyMap<Subject, number | null>;
  share: number;
  stated: boolean;
  subject: Subject;
}): number | null {
  const own = points.get(subject) ?? null;
  const memberPoints = members.map((member) => points.get(member) ?? null);

  if (!stated) {
    const total = memberPoints.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    return own !== null && total > 0 ? (share * own) / total : null;
  }

  const fallback = getSubjectShareFallback(memberPoints);
  const total = memberPoints.reduce<number>((sum, value) => sum + (value ?? fallback), 0);
  return total > 0 ? (share * (own ?? fallback)) / total : null;
}

/**
 * Each subject's share of the final score, split by points within each stated share and within what
 * no stated share covers. A qualifying test's subjects get 0; null where an uncovered subject's
 * points are unknown.
 */
export function listSubjectShares(structure: ExamStructure): (number | null)[] {
  const groups = listShareGroups(structure);
  const rest = Math.max(0, 1 - groups.reduce((sum, group) => sum + group.share, 0));

  const groupOf = (subject: Subject) =>
    groups.find((group) => isInGroup({ group, subject })) ?? null;

  const counted = listCountedSubjects(structure.subjects).filter(
    (subject) => !isQualifying({ structure, subject }),
  );

  const points = new Map(
    structure.subjects.map((subject) => [subject, getSubjectPoints({ structure, subject })]),
  );

  return structure.subjects.map((subject) => {
    if (isQualifying({ structure, subject })) {
      return 0;
    }

    const group = groupOf(subject);

    return getShareInGroup({
      members: counted.filter((member) => groupOf(member) === group),
      points,
      share: group?.share ?? rest,
      stated: group !== null,
      subject,
    });
  });
}

/**
 * Each subject's planning priority: its share of the final score, except that a qualifying test,
 * which can still eliminate the learner, weighs its minimum's share of the points share it would
 * have if it counted, and the shares that count scale to the rest.
 */
export function listPlanShares(structure: ExamStructure): (number | null)[] {
  const shares = listSubjectShares(structure);
  const counted = new Set(listCountedSubjects(structure.subjects));
  const points = structure.subjects.map((subject) => getSubjectPoints({ structure, subject }));
  const parts = structure.subjects.map((subject) => findQualifyingPart({ structure, subject }));

  const total = structure.subjects.reduce(
    (sum, subject, index) => sum + (counted.has(subject) ? (points[index] ?? 0) : 0),
    0,
  );

  const passing = parts.map((part, index) => {
    const own = points[index] ?? null;

    return part && own !== null && total > 0
      ? (getPassShare({ part, structure }) * own) / total
      : null;
  });

  const reserved = structure.subjects.reduce(
    (sum, subject, index) => sum + (counted.has(subject) ? (passing[index] ?? 0) : 0),
    0,
  );

  return shares.map((share, index) => {
    if (parts[index]) {
      return passing[index] ?? null;
    }

    return share === null ? null : share * (1 - reserved);
  });
}
