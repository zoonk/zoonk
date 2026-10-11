import { normalizeString } from "@zoonk/utils/string";

/** Objectives a chapter split off a mixed one takes from its lessons' can-do lines. */
const MAX_SPLIT_OBJECTIVES = 4;

/** A skill an outline teaches, with the area of the goal it sits in (an exam's subject). */
export type OutlineAreaSkill = { area?: string | null; key: string; name: string };

type AreaChapter = { skillKeys: readonly string[]; title: string };

type SplitLesson = { canDo: string; description: string; skills: readonly string[]; title: string };

type SplitChapter = AreaChapter & {
  description: string;
  lessons: readonly SplitLesson[];
  objectives: readonly string[];
};

/** A chapter tagged with skills of more than one area, and those areas in tag order. */
export type MixedAreaChapter = { areas: string[]; title: string };

function toAreaByKey(skills: readonly OutlineAreaSkill[]): Map<string, string> {
  return new Map(skills.flatMap((skill) => (skill.area ? [[skill.key, skill.area] as const] : [])));
}

function getChapterAreas({
  areaByKey,
  chapter,
}: {
  areaByKey: ReadonlyMap<string, string>;
  chapter: AreaChapter;
}): string[] {
  return [...new Set(chapter.skillKeys.flatMap((key) => areaByKey.get(key) ?? []))];
}

/**
 * Chapters tagged with skills of more than one area (an exam's subjects): a learner's plan files
 * each lesson under one of its chapter's skills, so a chapter that mixes Linguagens and
 * Matemática shows text lessons as math. The outline's pipeline and its eval scorer judge chapters
 * with it.
 */
export function findMixedAreaChapters({
  chapters,
  skills,
}: {
  chapters: readonly AreaChapter[];
  skills: readonly OutlineAreaSkill[];
}): MixedAreaChapter[] {
  const areaByKey = toAreaByKey(skills);

  return chapters.flatMap((chapter) => {
    const areas = getChapterAreas({ areaByKey, chapter });
    return areas.length > 1 ? [{ areas, title: chapter.title }] : [];
  });
}

/**
 * The area each lesson teaches, among the chapter's: the one its skills name (a lesson skill named
 * like a required skill is that skill), else the one area no lesson names when exactly one is
 * left. Null when a lesson names two areas or several are left for unnamed lessons.
 */
function getLessonAreas({
  areas,
  chapter,
  skills,
}: {
  areas: readonly string[];
  chapter: SplitChapter;
  skills: readonly OutlineAreaSkill[];
}): string[] | null {
  const areaByName = new Map(
    skills.flatMap((skill) =>
      skill.area && areas.includes(skill.area)
        ? [[normalizeString(skill.name), skill.area] as const]
        : [],
    ),
  );

  const named = chapter.lessons.map((lesson) => [
    ...new Set(lesson.skills.flatMap((name) => areaByName.get(normalizeString(name)) ?? [])),
  ]);

  const left = areas.filter((area) => !named.some((lessonAreas) => lessonAreas.includes(area)));
  const unnamed = named.some((lessonAreas) => lessonAreas.length === 0);

  if (named.some((lessonAreas) => lessonAreas.length > 1) || (unnamed && left.length !== 1)) {
    return null;
  }

  return named.map((lessonAreas) => lessonAreas[0] ?? left[0] ?? "");
}

/**
 * One chapter per area its lessons teach, in lesson order. The part with the chapter's first
 * lesson keeps the chapter's title and texts; another part is named after its first lesson, with
 * its lessons' can-do lines as objectives. Each part keeps its area's tags; tags without an area
 * stay on the first part, and an area no lesson teaches loses its tag.
 */
function splitChapter<T extends SplitChapter>({
  chapter,
  lessonAreas,
  skills,
}: {
  chapter: T;
  lessonAreas: readonly string[];
  skills: readonly OutlineAreaSkill[];
}): T[] {
  const areaByKey = toAreaByKey(skills);

  return [...new Set(lessonAreas)].map((area, index) => {
    const lessons = chapter.lessons.filter((_, position) => lessonAreas[position] === area);

    const skillKeys = chapter.skillKeys.filter(
      (key) => areaByKey.get(key) === area || (index === 0 && !areaByKey.has(key)),
    );

    const [first] = lessons;

    if (index === 0 || !first) {
      return { ...chapter, lessons, skillKeys };
    }

    return {
      ...chapter,
      description: first.description,
      lessons,
      objectives: lessons.slice(0, MAX_SPLIT_OBJECTIVES).map((lesson) => lesson.canDo),
      skillKeys,
      title: first.title,
    };
  });
}

/**
 * Repairs chapters that mix areas (`findMixedAreaChapters`) where the lessons say which area each
 * teaches: the chapter splits into one per area. A chapter whose lessons don't say stays whole,
 * for the outline to be written again.
 */
export function splitMixedAreaChapters<T extends SplitChapter>({
  chapters,
  skills,
}: {
  chapters: readonly T[];
  skills: readonly OutlineAreaSkill[];
}): T[] {
  const areaByKey = toAreaByKey(skills);

  return chapters.flatMap((chapter) => {
    const areas = getChapterAreas({ areaByKey, chapter });

    if (areas.length < 2) {
      return [chapter];
    }

    const lessonAreas = getLessonAreas({ areas, chapter, skills });
    return lessonAreas ? splitChapter({ chapter, lessonAreas, skills }) : [chapter];
  });
}
