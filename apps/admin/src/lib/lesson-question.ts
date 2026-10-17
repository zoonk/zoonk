import { type LessonQuestionContextKind, type LessonQuestionStatus } from "@zoonk/db";

type AdminCourseRef = { id: string; title: string };

type QuestionThreadLesson = {
  libraryLesson: {
    homeChapter: { homeCourse: AdminCourseRef | null; title: string } | null;
    id: string;
    title: string;
  } | null;
};

export type AdminQuestionLessonContext = {
  chapterTitle: string | null;
  course: AdminCourseRef | null;
  lessonHref: string;
  lessonLabel: string;
};

export function getAdminQuestionStatusVariant(status: LessonQuestionStatus) {
  if (status === "completed") {
    return "success" as const;
  }

  if (status === "failed") {
    return "destructive" as const;
  }

  return "secondary" as const;
}

export function getAdminQuestionContextLabel({
  contextKind,
  stepNumber,
}: {
  contextKind: LessonQuestionContextKind;
  stepNumber: number | null;
}) {
  if (contextKind === "answer") {
    return stepNumber ? `Learner answer · item ${stepNumber}` : "Learner answer";
  }

  if (contextKind === "step") {
    return stepNumber ? `Lesson content · item ${stepNumber}` : "Lesson content";
  }

  return "Lesson";
}

/**
 * A thread is about a Library lesson, placed by its home chapter and course. Null means the lesson
 * was deleted.
 */
export function getAdminQuestionLessonContext(
  thread: QuestionThreadLesson,
): AdminQuestionLessonContext | null {
  if (!thread.libraryLesson) {
    return null;
  }

  const { homeChapter, id, title } = thread.libraryLesson;

  return {
    chapterTitle: homeChapter?.title ?? null,
    course: homeChapter?.homeCourse ?? null,
    lessonHref: `/lessons/${id}`,
    lessonLabel: title,
  };
}
