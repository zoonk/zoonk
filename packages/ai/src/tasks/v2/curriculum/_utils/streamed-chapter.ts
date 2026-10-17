import { type CourseLevel } from "./course-levels";
import { chapterSchema } from "./course-outline-schema";
import { type CourseOutline, normalizeCourseOutline } from "./normalize-course-outline";
import { type OutlineAreaSkill } from "./outline-areas";

type OutlineChapter = CourseOutline["chapters"][number];

type CleanInput = {
  level: CourseLevel;
  requiredSkillKeys: readonly string[];
  skillAreas?: readonly OutlineAreaSkill[];
};

/** A streamed chapter cleaned the way the whole outline is: none, or more than one once split. */
function cleanChapter({ chapter, ...input }: CleanInput & { chapter: unknown }): OutlineChapter[] {
  const parsed = chapterSchema.safeParse(chapter);

  if (!parsed.success) {
    return [];
  }

  return normalizeCourseOutline({ ...input, raw: { chapters: [parsed.data] } }).chapters;
}

/**
 * The first chapter of an outline still being written that `isWanted` accepts, once it's complete
 * (the model started the chapter after it), cleaned the way the whole outline is, with the complete
 * chapters before it, so it's where it will be in the finished outline. Null until then.
 */
export function readStreamedChapter({
  chapters = [],
  isWanted,
  ...input
}: CleanInput & {
  chapters?: readonly unknown[];
  isWanted: (chapter: OutlineChapter) => boolean;
}): { before: OutlineChapter[]; chapter: OutlineChapter } | null {
  const complete = chapters.slice(0, -1).flatMap((chapter) => cleanChapter({ ...input, chapter }));

  const index = complete.findIndex((chapter) => isWanted(chapter));
  const chapter = complete[index];

  return chapter ? { before: complete.slice(0, index), chapter } : null;
}
