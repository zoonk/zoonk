import { namesMatch } from "../../exams/_utils/name-match";

/** Absent or empty when the documents tie the format to no part: every part asks it. */
type SectionedFormat = { sections?: readonly string[] };

function isAskedIn({
  format,
  names,
}: {
  format: SectionedFormat;
  names: readonly string[];
}): boolean {
  return (
    !format.sections?.length ||
    format.sections.some((part) => names.some((name) => namesMatch(part, name)))
  );
}

/**
 * The formats a part asks. The documents and the exam's reading may name its parts apart, so a
 * part no format names asks them all.
 */
export function listAskedIn<Format extends SectionedFormat>({
  formats,
  names,
}: {
  formats: readonly Format[];
  names: readonly string[];
}): Format[] {
  const asked = formats.filter((format) => isAskedIn({ format, names }));
  return names.length > 0 && asked.length > 0 ? asked : [...formats];
}

/** A skill without an area could be in any part; when no skill's area matches, all of them. */
export function listAskedSkills<Skill extends { area: string | null }>({
  format,
  skills,
}: {
  format: SectionedFormat;
  skills: readonly Skill[];
}): Skill[] {
  const asked = skills.filter(
    (skill) => skill.area === null || isAskedIn({ format, names: [skill.area] }),
  );

  return asked.length > 0 ? asked : [...skills];
}
