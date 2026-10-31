import { type CourseFormat, CourseLevel } from "@zoonk/db/enums";

const LEVEL_ORDER = Object.values(CourseLevel);

/** An overview is a shorter course of its own, so it isn't part of the path to mastery. */
export const MASTERY_LEVELS: readonly CourseLevel[] = ["beginner", "intermediate", "advanced"];

/**
 * The Library's shared subject and language courses lead from Beginner to Advanced. An exam's course
 * follows the exam's subjects, and a learner's private course only their material.
 */
const PATH_FORMATS: ReadonlySet<CourseFormat> = new Set(["core", "language"]);

/**
 * A course on the path to mastery covers every mastery level, and its chapters are written as
 * learners reach them, so a level with none yet still belongs to it.
 */
export function listCourseLevels({
  format,
  written,
}: {
  format: CourseFormat;
  written: readonly CourseLevel[];
}): CourseLevel[] {
  const onPath =
    PATH_FORMATS.has(format) && written.some((level) => MASTERY_LEVELS.includes(level));

  const levels = new Set([...written, ...(onPath ? MASTERY_LEVELS : [])]);

  return LEVEL_ORDER.filter((level) => levels.has(level));
}
