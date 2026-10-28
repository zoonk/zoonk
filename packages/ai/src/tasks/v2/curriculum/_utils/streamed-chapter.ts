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

function cleanChapter({ chapter, ...input }: CleanInput & { chapter: unknown }): OutlineChapter[] {
  const parsed = chapterSchema.safeParse(chapter);

  if (!parsed.success) {
    return [];
  }

  return normalizeCourseOutline({ ...input, raw: { chapters: [parsed.data] } }).chapters;
}

/** A chapter is complete once the model starts the next one. Null until then. */
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
