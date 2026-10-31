import { isJsonObject } from "@zoonk/utils/json";
import { normalizeString } from "@zoonk/utils/string";

export type CutoffTarget = {
  course: string | null;
  institution: string | null;
  key: string;
  position: string | null;
};

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getCutoffTarget({
  details,
  role,
}: {
  details: unknown;
  role: string | null;
}): CutoffTarget | null {
  const record = isJsonObject(details) ? details : {};
  const course = readText(record.targetCourse);
  const institution = readText(record.institution);
  const named = readText(record.targetPosition);
  const position = named && (readText(role) ?? named);

  if (course && institution) {
    return {
      course,
      institution,
      key: `course:${normalizeString(course)}|${normalizeString(institution)}`,
      position: null,
    };
  }

  return position
    ? { course: null, institution, key: `position:${normalizeString(position)}`, position }
    : null;
}
