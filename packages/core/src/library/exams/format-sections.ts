import { namesMatch } from "../../exams/_utils/name-match";
import { type ExamStructure } from "./blueprint-contract";
import { listSubjectNames } from "./subject-names";

type SectionedFormat = { sections?: readonly string[] };

export function findUnknownScopeFormats<Format extends SectionedFormat>(
  formats: readonly Format[],
): Format[] {
  return formats.some((format) => format.sections?.length)
    ? formats.filter((format) => !format.sections?.length)
    : [];
}

function isAskedIn({
  format,
  names,
}: {
  format: SectionedFormat;
  names: readonly string[];
}): boolean {
  return format.sections?.some((part) => names.some((name) => namesMatch(part, name))) ?? false;
}

export function listAskedIn<Format extends SectionedFormat>({
  formats,
  names,
}: {
  formats: readonly Format[];
  names: readonly string[];
}): Format[] {
  if (names.length === 0) {
    return [...formats];
  }

  const asked = formats.filter((format) => isAskedIn({ format, names }));
  const unscoped = formats.filter((format) => !format.sections?.length);

  if (asked.length > 0) {
    return asked;
  }

  return unscoped.length > 0 ? unscoped : [...formats];
}


export function listAskedSkills<Skill extends { area: string | null }>({
  format,
  skills,
  structure = null,
}: {
  format: SectionedFormat;
  skills: readonly Skill[];
  structure?: Pick<ExamStructure, "subjects"> | null;
}): Skill[] {
  const asked = skills.filter(
    (skill) =>
      !format.sections?.length ||
      skill.area === null ||
      isAskedIn({ format, names: listSubjectNames({ area: skill.area, structure }) }),
  );

  return asked;
}
