import { type SyllabusSubject } from "@zoonk/core/view-models/syllabus/contract";

type GroupableSubject = Pick<SyllabusSubject, "group"> & Partial<Pick<SyllabusSubject, "source">>;

export type SubjectGroup<Subject extends GroupableSubject = SyllabusSubject> = {
  extra: boolean;
  name: string | null;
  subjects: Subject[];
};

function getGroupKey(subject: GroupableSubject): string {
  return subject.source === "plan" ? "extra" : `notice:${subject.group ?? ""}`;
}

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
