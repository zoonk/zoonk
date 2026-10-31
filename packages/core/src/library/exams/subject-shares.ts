import { getSubjectShareFallback } from "../../exams/_utils/subject-share-fallback";
import { listCountedSubjects } from "../../exams/choices/exam-choices";
import { type ExamStructure, type ScoredPart } from "./blueprint-contract";
import { coversSubject } from "./final-share-cover";
import { getPartMaxPoints } from "./part-points";
import { getSubjectPoints } from "./subject-points";

type Subject = ExamStructure["subjects"][number];

const PERCENT = 100;

type ShareGroup = { parts: readonly string[]; share: number; term: boolean };

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

/**
 * A subject's own stated weight is a share of its own where no term of the final score covers it;
 * inside a term it counts when it fits the term's share (`splitTerm`).
 */
function listShareGroups(structure: ExamStructure): ShareGroup[] {
  const terms = structure.mock?.scoring.finalShares ?? [];

  const own = structure.subjects.flatMap((subject) =>
    subject.weight !== null && !terms.some((term) => coversSubject({ parts: term.parts, subject }))
      ? [{ parts: [subject.name], share: subject.weight, term: false }]
      : [],
  );

  return [...terms.map((term) => ({ parts: term.parts, share: term.share, term: true })), ...own];
}

/** Rounded weights, such as 0.33 and 0.17 of a 0.5 term, can miss its share by a little. */
const SHARE_TOLERANCE = 0.01;

/**
 * The weights a term's subjects state count when they fit its share, and the rest of the share goes
 * to its other subjects by points. Weights past the share, or leaving part of it to no subject,
 * contradict the term, so it splits by points.
 */
function splitTerm({ members, share }: { members: readonly Subject[]; share: number }) {
  const weighed = members.filter((member) => member.weight !== null);
  const others = members.filter((member) => member.weight === null);
  const remainder = share - weighed.reduce((sum, member) => sum + (member.weight ?? 0), 0);

  const fits =
    weighed.length > 0 &&
    remainder >= -SHARE_TOLERANCE &&
    (others.length > 0 || remainder <= SHARE_TOLERANCE);

  return fits
    ? { byPoints: others, pool: Math.max(0, remainder), weighed: true }
    : { byPoints: members, pool: share, weighed: false };
}

function getShareInGroup({
  group,
  members,
  points,
  rest,
  subject,
}: {
  group: ShareGroup | null;
  members: readonly Subject[];
  points: ReadonlyMap<Subject, number | null>;
  rest: number;
  subject: Subject;
}): number | null {
  const own = points.get(subject) ?? null;

  if (!group) {
    const total = members.reduce((sum, member) => sum + (points.get(member) ?? 0), 0);
    return own !== null && total > 0 ? (rest * own) / total : null;
  }

  const split = group.term
    ? splitTerm({ members, share: group.share })
    : { byPoints: members, pool: group.share, weighed: false };

  if (split.weighed && subject.weight !== null) {
    return subject.weight;
  }

  const shared = split.byPoints.map((member) => points.get(member) ?? null);
  const fallback = getSubjectShareFallback(shared);
  const total = shared.reduce<number>((sum, value) => sum + (value ?? fallback), 0);
  return total > 0 ? (split.pool * (own ?? fallback)) / total : null;
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
    groups.find((group) => coversSubject({ parts: group.parts, subject })) ?? null;

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
      group,
      members: counted.filter((member) => groupOf(member) === group),
      points,
      rest,
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
