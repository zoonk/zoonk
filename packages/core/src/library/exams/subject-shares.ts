import { getSubjectShareFallback } from "../../exams/_utils/subject-share-fallback";
import { listCountedSubjects } from "../../exams/choices/exam-choices";
import { type ExamStructure } from "./blueprint-contract";
import { getSubjectPoints } from "./subject-points";

type Subject = ExamStructure["subjects"][number];

type ShareGroup = { parts: readonly string[]; share: number };

function isInGroup({ group, subject }: { group: ShareGroup; subject: Subject }): boolean {
  return [subject.name, subject.group, subject.partOf].some(
    (name) => typeof name === "string" && group.parts.includes(name),
  );
}

function isQualifying({ structure, subject }: { structure: ExamStructure; subject: Subject }) {
  return (structure.mock?.scoring.parts ?? []).some(
    (part) => part.qualifying && (part.name === subject.name || part.name === subject.group),
  );
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
