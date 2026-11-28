import { type GroupedSubject, listSubjectGroups } from "@zoonk/utils/exam-groups";

type PartsOf = {
  mock: { sections: readonly { name: string }[] } | null;
  subjects: readonly (GroupedSubject & { name: string })[];
};

/** The names a format's `sections` may take: the mock's sections, the subjects and their groups. */
export function listExamParts(exam: PartsOf | null): string[] {
  const sections = (exam?.mock?.sections ?? []).map((section) => section.name);

  const subjects = (exam?.subjects ?? []).flatMap((subject) => [
    subject.name,
    ...listSubjectGroups(subject),
  ]);

  return [...new Set([...sections, ...subjects].filter((name) => name.trim()))];
}
