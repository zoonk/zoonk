type PartsOf = {
  mock: { sections: readonly { name: string }[] } | null;
  subjects: readonly { group?: string | null; name: string }[];
};

/** The names a format's `sections` may take: the mock's sections, the subjects and their groups. */
export function listExamParts(exam: PartsOf | null): string[] {
  const sections = (exam?.mock?.sections ?? []).map((section) => section.name);

  const subjects = (exam?.subjects ?? []).flatMap((subject) =>
    subject.group ? [subject.name, subject.group] : [subject.name],
  );

  return [...new Set([...sections, ...subjects].filter((name) => name.trim()))];
}
