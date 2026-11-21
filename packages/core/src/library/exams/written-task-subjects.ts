import { normalizeString } from "@zoonk/utils/string";

type Named = { choiceGroup?: string | null; group?: string | null; name: string };

/** The subjects a written task's named parts, disciplines or choices stand for, in the notice's order. */
export function findTaskSubjects<T extends Named>({
  names,
  subjects,
}: {
  names: readonly string[];
  subjects: readonly T[];
}): T[] {
  const said = new Set(names.map((name) => normalizeString(name)).filter(Boolean));

  return subjects.filter((subject) =>
    [subject.name, subject.group, subject.choiceGroup].some(
      (label) => label && said.has(normalizeString(label)),
    ),
  );
}
