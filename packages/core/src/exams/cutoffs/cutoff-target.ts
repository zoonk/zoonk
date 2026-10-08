import { isJsonObject } from "@zoonk/utils/json";
import { normalizeString } from "@zoonk/utils/string";

/** What a goal aims for that has a cut-off: a course at an institution, or a position. */
export type CutoffTarget = {
  course: string | null;
  institution: string | null;
  /** Shares one lookup between every learner aiming at the same target of the same exam. */
  key: string;
  position: string | null;
};

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * The goal's target with a published cut-off, from what the learner said: a course at an
 * institution (cut-offs differ by institution, so a course alone has none), or the position they
 * named, by the exam's own role when it has one, which names it the same way for everyone. An
 * exam's role alone isn't a target: it can be a phase ("1ª fase") that passes everyone above a
 * mark. Null otherwise.
 */
export function getCutoffTarget({
  details,
  role,
}: {
  details: unknown;
  /** The exam's role (a public-service exam for one position), when it has one. */
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
