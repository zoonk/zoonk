import { type SyllabusSubject } from "@zoonk/core/view-models/syllabus/contract";

type GroupableSubject = Pick<SyllabusSubject, "group"> & Partial<Pick<SyllabusSubject, "extra">>;

export type SubjectGroup<Subject extends GroupableSubject = SyllabusSubject> = {
  extra: boolean;
  name: string | null;
  subjects: Subject[];
};

const EXTRA_KEY = "extra";

function getGroupKey(subject: GroupableSubject, modules: boolean): string {
  if (subject.extra) {
    return EXTRA_KEY;
  }

  return modules ? "all" : `notice:${subject.group ?? ""}`;
}

/** The notice's groups in its order, or one run of modules, then what the exam doesn't test. */
export function groupSubjects<Subject extends GroupableSubject>(
  subjects: readonly Subject[],
  { modules }: { modules: boolean },
): SubjectGroup<Subject>[] {
  const keys = [...new Set(subjects.map((subject) => getGroupKey(subject, modules)))].toSorted(
    (first, second) => Number(first === EXTRA_KEY) - Number(second === EXTRA_KEY),
  );

  return keys.map((key) => {
    const inGroup = subjects.filter((subject) => getGroupKey(subject, modules) === key);
    const named = !modules && key !== EXTRA_KEY;

    return {
      extra: key === EXTRA_KEY,
      name: named ? (inGroup[0]?.group ?? null) : null,
      subjects: inGroup,
    };
  });
}
