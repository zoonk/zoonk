import { type SyllabusSubject } from "@zoonk/core/view-models/syllabus/contract";

type GroupableSubject = Pick<SyllabusSubject, "group"> & Partial<Pick<SyllabusSubject, "extra">>;

export type SubjectGroup<Subject extends GroupableSubject = SyllabusSubject> = {
  extra: boolean;
  name: string | null;
  subjects: Subject[];
};

const EXTRA_KEY = "extra";
const UNGROUPED_KEY = "ungrouped";

function getGroupKey(subject: GroupableSubject, modules: boolean): string {
  if (subject.extra) {
    return EXTRA_KEY;
  }

  if (modules || subject.group === null) {
    return UNGROUPED_KEY;
  }

  return `notice:${subject.group}`;
}

function getGroupRank(key: string): number {
  if (key === UNGROUPED_KEY) {
    return 0;
  }

  return key === EXTRA_KEY ? 2 : 1;
}

/**
 * Subjects with no heading lead, so none reads as part of the group above it; then the notice's
 * groups in its order, or one run of modules; then what the exam doesn't test.
 */
export function groupSubjects<Subject extends GroupableSubject>(
  subjects: readonly Subject[],
  { modules }: { modules: boolean },
): SubjectGroup<Subject>[] {
  const keys = [...new Set(subjects.map((subject) => getGroupKey(subject, modules)))].toSorted(
    (first, second) => getGroupRank(first) - getGroupRank(second),
  );

  return keys.map((key) => {
    const inGroup = subjects.filter((subject) => getGroupKey(subject, modules) === key);
    const named = key !== EXTRA_KEY && key !== UNGROUPED_KEY;

    return {
      extra: key === EXTRA_KEY,
      name: named ? (inGroup[0]?.group ?? null) : null,
      subjects: inGroup,
    };
  });
}
