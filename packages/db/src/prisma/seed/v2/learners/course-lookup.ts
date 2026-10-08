import { type SeedLanguage } from "../_utils/localize";
import { libraryIds } from "../library/library-ids";
import { type SeedChapter, type SeedCourse, type SeedLesson } from "../library/types";

function findLesson(
  course: SeedCourse,
  key: string,
): { chapter: SeedChapter | null; lesson: SeedLesson } {
  const inChapter = course.chapters.flatMap((chapter) =>
    chapter.lessons.filter((lesson) => lesson.key === key).map((lesson) => ({ chapter, lesson })),
  );

  const explanation = (course.explanations ?? []).find((lesson) => lesson.key === key);
  const found = inChapter[0] ?? (explanation ? { chapter: null, lesson: explanation } : null);

  if (!found) {
    throw new Error(`Seed course "${course.key}" has no lesson "${key}"`);
  }

  return found;
}

function findChapter(course: SeedCourse, key: string): SeedChapter {
  const chapter = course.chapters.find((item) => item.key === key);

  if (!chapter) {
    throw new Error(`Seed course "${course.key}" has no chapter "${key}"`);
  }

  return chapter;
}

/** Ids and titles of a seeded course's rows in one language, looked up by key. */
export function courseLookup(course: SeedCourse, language: SeedLanguage) {
  return {
    chapter: (key: string) => {
      const chapter = findChapter(course, key);

      return {
        area: chapter.area?.in(language) ?? null,
        id: libraryIds.chapter(course.key, key, language),
        lessonKeys: chapter.lessons.map((lesson) => lesson.key),
        title: chapter.title.in(language),
        weight: chapter.weight ?? null,
        writtenTest: chapter.writtenTest ?? false,
      };
    },
    courseId: libraryIds.course(course.key, language),
    courseTitle: course.title.in(language),
    item: (key: string) => libraryIds.item(course.key, key, language),
    lesson: (key: string) => {
      const { chapter, lesson } = findLesson(course, key);

      return {
        canDo: lesson.canDo?.in(language) ?? null,
        chapterId: chapter ? libraryIds.chapter(course.key, chapter.key, language) : null,
        chapterKey: chapter?.key ?? null,
        id: libraryIds.lesson(course.key, key, language),
        minutes: lesson.minutes,
        skillIds: lesson.skills.map((skill) => libraryIds.skill(course.key, skill, language)),
        skillKeys: lesson.skills,
        steps: lesson.steps ?? [],
        title: lesson.title.in(language),
      };
    },
    skill: (key: string) => libraryIds.skill(course.key, key, language),
    skillName: (key: string) => {
      const skill = course.skills.find((item) => item.key === key);

      if (!skill) {
        throw new Error(`Seed course "${course.key}" has no skill "${key}"`);
      }

      return skill.name.in(language);
    },
    step: (lesson: string, position: number) =>
      libraryIds.step(course.key, lesson, position, language),
  };
}

export type CourseLookup = ReturnType<typeof courseLookup>;
