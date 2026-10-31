import { namesMatch } from "../../exams/_utils/name-match";

type SectionedFormat = { sections?: readonly string[] };

export function isAskedIn({
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
