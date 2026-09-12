import "server-only";
import { getChapterById } from "../../chapters/get-chapter-by-id";
import { getCourseById } from "../../courses/get-course-by-id";
import { type LearningPathChapter, getCourseLearningPath } from "../../courses/learning-plan";
import { CURRENT_CURRICULUM_VERSION } from "../../courses/learning-plan-contract";
import { getLessonById } from "../../lessons/get-lesson-by-id";
import { type LessonScope } from "../../lessons/lesson-scope";

async function resolveScope(scope: LessonScope) {
  const lesson = "lessonId" in scope ? await getLessonById({ lessonId: scope.lessonId }) : null;
  const chapterId = "chapterId" in scope ? scope.chapterId : lesson?.chapterId;
  const chapter = chapterId ? await getChapterById({ chapterId }) : null;
  const courseId = "courseId" in scope ? scope.courseId : chapter?.courseId;
  return { chapter, courseId, lesson };
}

/** Undefined preserves legacy navigation; null denotes an unavailable current scope. */
export async function getLearningPathScope(scope: LessonScope & { includeCoursePath?: boolean }) {
  const { chapter, courseId, lesson } = await resolveScope(scope);

  if (!courseId) {
    return null;
  }

  const course = await getCourseById({ courseId });

  if (!course) {
    return null;
  }

  if (course.curriculumVersion < CURRENT_CURRICULUM_VERSION) {
    return;
  }

  let path = await getCourseLearningPath({ courseId });

  if (path.status !== "ready") {
    return null;
  }

  // Re-select a focused path explicitly after a curriculum replacement; its old IDs cannot authorize a default continuation.
  if (!chapter && path.needsPlan && path.plan?.depth === "focused") {
    return null;
  }

  // A learner can browse a chapter outside their saved path without changing that path.
  if (chapter && !path.chapters.some((item) => item.id === chapter.id)) {
    path = await getCourseLearningPath({
      courseId,
      preferences: {
        depth: chapter.level === "overview" ? "overview" : "complete",
        hiddenLessonKinds: path.plan?.hiddenLessonKinds,
        startingLevel: chapter.level,
      },
    });

    if (path.status !== "ready") {
      return null;
    }
  }

  const chapters =
    chapter && !scope.includeCoursePath
      ? path.chapters.filter((item) => item.id === chapter.id)
      : path.chapters;

  return { chapters: lesson ? selectLesson(chapters, lesson.id) : chapters, course };
}

function selectLesson(chapters: LearningPathChapter[], lessonId: string) {
  return chapters.flatMap((chapter) => {
    const lesson = chapter.lessons.find((candidate) => candidate.id === lessonId);

    return lesson
      ? [
          {
            ...chapter,
            completedLessons: Number(lesson.isCompleted),
            isCompleted: lesson.isCompleted,
            lessons: [lesson],
            totalLessons: 1,
          },
        ]
      : [];
  });
}

export type LearningPathScope = NonNullable<Awaited<ReturnType<typeof getLearningPathScope>>>;

/** Unknown chapter sizes cannot be expressed as a trustworthy lesson percentage. */
export function getLearningPathPercent({ chapters }: LearningPathScope) {
  if (chapters.some((chapter) => chapter.totalLessons === 0)) {
    return null;
  }

  const total = chapters.reduce((sum, chapter) => sum + chapter.totalLessons, 0);
  const completed = chapters.reduce((sum, chapter) => sum + chapter.completedLessons, 0);
  return total > 0 ? Math.round((completed / total) * 100) : null;
}
