import { namesMatch } from "../../exams/_utils/name-match";

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
  const unknown = new Set(findUnknownScopeFormats(asked.length > 0 ? formats : []));

  return formats.filter(
    (format) => isAskedIn({ format, names }) || (!format.sections?.length && !unknown.has(format)),
  );
}

export function listAskedSkills<Skill extends { area: string | null }>({
  format,
  skills,
}: {
  format: SectionedFormat;
  skills: readonly Skill[];
}): Skill[] {
  const asked = skills.filter(
    (skill) => !format.sections?.length || skill.area === null || isAskedIn({ format, names: [skill.area] }),
  );

  return asked.length > 0 ? asked : [...skills];
}
