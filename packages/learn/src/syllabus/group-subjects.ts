import { type SyllabusSubject } from "@zoonk/core/view-models/syllabus/contract";

/** What grouping needs of a subject: the notice's group, and whether the plan added it. */
type GroupableSubject = Pick<SyllabusSubject, "group"> & Partial<Pick<SyllabusSubject, "source">>;

/**
 * A run of subjects shown together: the notice's group ("Conhecimentos básicos (P1)"), the notice's
 * subjects when it has no groups (`name` null), or the areas the plan adds outside the notice.
 */
export type SubjectGroup<Subject extends GroupableSubject = SyllabusSubject> = {
  extra: boolean;
  name: string | null;
  subjects: Subject[];
};

function getGroupKey(subject: GroupableSubject): string {
  return subject.source === "plan" ? "extra" : `notice:${subject.group ?? ""}`;
}

/**
 * The subjects in groups, in the order each group first appears, so a notice that lists P1 then P2
 * reads the same way on the Journey and the exam screen; the plan's own areas come last.
 */
export function groupSubjects<Subject extends GroupableSubject>(
  subjects: readonly Subject[],
  { modules }: { modules: boolean },
): SubjectGroup<Subject>[] {
  if (modules) {
    return [{ extra: false, name: null, subjects: [...subjects] }];
  }

  const keys = [...new Set(subjects.map((subject) => getGroupKey(subject)))].toSorted(
    (first, second) => Number(first === "extra") - Number(second === "extra"),
  );

  return keys.map((key) => {
    const inGroup = subjects.filter((subject) => getGroupKey(subject) === key);

    return {
      extra: key === "extra",
      name: key === "extra" ? null : (inGroup[0]?.group ?? null),
      subjects: inGroup,
    };
  });
}
