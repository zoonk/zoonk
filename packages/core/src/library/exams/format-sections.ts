import { namesMatch } from "../../exams/_utils/name-match";
import { type ExamStructure } from "./blueprint-contract";

type SectionedFormat = { sections?: readonly string[] };

function isAskedIn({
  format,
  names,
}: {
  format: SectionedFormat;
  names: readonly string[];
}): boolean {
  return format.sections?.some((part) => names.some((name) => namesMatch(part, name))) ?? false;
}

export function listExamPartNames(structure: ExamStructure | null): string[] {
  const sections = (structure?.mock?.sections ?? []).map((section) => section.name);

  const subjects = (structure?.subjects ?? []).flatMap((subject) =>
    [subject.name, subject.group, subject.partOf, subject.shortName].filter(
      (name) => typeof name === "string",
    ),
  );

  return [...new Set([...sections, ...subjects])];
}

export function listAskedIn<Format extends SectionedFormat>({
  allNames,
  formats,
  names,
}: {
  allNames: readonly string[];
  formats: readonly Format[];
  names: readonly string[];
}): Format[] {
  if (names.length === 0) {
    return [...formats];
  }

  const scoped = formats.filter((format) => format.sections?.length);

  const asked = scoped.filter(
    (format) => isAskedIn({ format, names }) || !isAskedIn({ format, names: allNames }),
  );

  return asked.length > 0 ? asked : formats.filter((format) => !format.sections?.length);
}
