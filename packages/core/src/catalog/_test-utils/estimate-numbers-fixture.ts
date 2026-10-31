import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import {
  chapterSkillFixture,
  courseChapterFixture,
  libraryChapterFixture,
} from "@zoonk/testing/fixtures/library-chapters";
import {
  chapterLessonFixture,
  lessonSkillFixture,
  libraryLessonsFixture,
} from "@zoonk/testing/fixtures/library-lessons";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";

const NUMBERS_TODAY = "2020-09-28";
export const NUMBERS_NOW = new Date(`${NUMBERS_TODAY}T12:00:00Z`);
const STUDY_WEEK_DAYS = 5;
const ORIGINAL_LESSONS_PER_CHAPTER = 4;
const AUTHORED_LESSON_MINUTES = 5;
const QUESTION_SUBJECTS = 4;
const QUESTIONS_PER_SUBJECT = 45;
const UNWRITTEN_LESSONS = 300;

export const NUMBERS_DAYS = Array.from({ length: STUDY_WEEK_DAYS }, (_, index) => index + 1);

export async function estimateNumbersFixture({
  includeUnwritten = true,
  lessonsPerChapter = ORIGINAL_LESSONS_PER_CHAPTER,
  names = ["Math", "Science", "Languages", "Humanities", "Essay"],
}: { includeUnwritten?: boolean; lessonsPerChapter?: number; names?: string[] } = {}) {
  const [course, blueprint, skills] = await Promise.all([
    courseFixture({ format: "exam", isPublished: true, visibility: "public" }),
    examBlueprintFixture({
      structure: {
        formats: [],
        mock: {
          adaptive: false,
          citations: [],
          order: null,
          scoring: { description: "Raw points", method: "raw" },
          sections: [],
          timeLimitMinutes: 60,
          totalQuestions: 180,
        },
        rules: [],
        subjects: names.map((name, index) => ({
          citation: { passage: "Exam subjects", sourceId: "notice" },
          name,
          questions: index < QUESTION_SUBJECTS ? QUESTIONS_PER_SUBJECT : null,
          topics: [name],
          weight: null,
        })),
      },
    }),
    Promise.all(
      [...names, ...(includeUnwritten ? ["Additional mathematics"] : [])].map((name) =>
        skillFixture({ name }),
      ),
    ),
  ]);

  const chapters = await Promise.all(
    skills.slice(0, names.length).map(async (skill, index) => {
      const chapter = await libraryChapterFixture();

      const lessons = await libraryLessonsFixture(lessonsPerChapter, {
        estimatedMinutes: AUTHORED_LESSON_MINUTES,
        homeChapterId: chapter.id,
      });

      await Promise.all([
        courseChapterFixture({
          area: names[index],
          chapterId: chapter.id,
          courseId: course.id,
          position: index,
        }),
        chapterSkillFixture({ chapterId: chapter.id, skillId: skill.id }),
        ...lessons.flatMap((lesson, position) => [
          chapterLessonFixture({ chapterId: chapter.id, lessonId: lesson.id, position }),
          lessonSkillFixture({ lessonId: lesson.id, skillId: skill.id }),
        ]),
      ]);

      return { chapter, lessons };
    }),
  );

  const graph = {
    phases: [{ milestone: null, name: "Exam subjects" }],
    skills: skills.map((skill, index) => ({
      area: names[index] ?? "Math",
      courseIds: [course.id],
      lessons: index < names.length ? 30 : UNWRITTEN_LESSONS,
      name: skill.name,
      phase: 0,
      skillId: skill.id,
      topics: [names[index] ?? "Math"],
      weight: 1,
    })),
  };

  await prisma.examSkillGraph.create({
    data: {
      examBlueprintId: blueprint.id,
      generatedAt: NUMBERS_NOW,
      graph,
      model: "fixture",
      primaryCourseId: course.id,
      promptVersion: "fixture",
      runId: "fixture",
    },
  });

  return { blueprint, chapters, course, graph, skills };
}
