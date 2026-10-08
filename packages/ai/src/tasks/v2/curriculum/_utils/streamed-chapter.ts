import { type CourseLevel } from "./course-levels";
import { chapterSchema } from "./course-outline-schema";
import { type CourseOutline, normalizeCourseOutline } from "./normalize-course-outline";

type OutlineChapter = CourseOutline["chapters"][number];

function cleanChapter({
  chapter,
  level,
  requiredSkillKeys,
}: {
  chapter: unknown;
  level: CourseLevel;
  requiredSkillKeys: readonly string[];
}): OutlineChapter | null {
  const parsed = chapterSchema.safeParse(chapter);

  if (!parsed.success) {
    return null;
  }

  const [clean] = normalizeCourseOutline({
    level,
    raw: { chapters: [parsed.data] },
    requiredSkillKeys,
  }).chapters;

  return clean ?? null;
}

/**
 * The first chapter of an outline still being written that `isWanted` accepts, once it's complete
 * (the model started the chapter after it), cleaned the way the whole outline is, with the complete
 * chapters before it, so it's where it will be in the finished outline. Null until then.
 */
export function readStreamedChapter({
  chapters = [],
  isWanted,
  level,
  requiredSkillKeys,
}: {
  chapters?: readonly unknown[];
  isWanted: (chapter: OutlineChapter) => boolean;
  level: CourseLevel;
  requiredSkillKeys: readonly string[];
}): { before: OutlineChapter[]; chapter: OutlineChapter } | null {
  const complete = chapters.slice(0, -1).flatMap((chapter) => {
    const clean = cleanChapter({ chapter, level, requiredSkillKeys });
    return clean ? [clean] : [];
  });

  const index = complete.findIndex((chapter) => isWanted(chapter));
  const chapter = complete[index];

  return chapter ? { before: complete.slice(0, index), chapter } : null;
}
