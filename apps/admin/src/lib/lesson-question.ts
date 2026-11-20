import { type LessonQuestionContextKind } from "@zoonk/db";

type AdminCourseRef = { id: string; title: string };

type QuestionThreadLesson = {
  libraryLesson: {
    homeChapter: { homeCourse: AdminCourseRef | null; title: string } | null;
    id: string;
    title: string;
  } | null;
};

type AdminQuestionLessonContext = {
  chapterTitle: string | null;
  course: AdminCourseRef | null;
  lessonHref: string;
  lessonLabel: string;
};

export function getAdminQuestionContextLabel({
  contextKind,
  stepNumber,
}: {
  contextKind: LessonQuestionContextKind;
  stepNumber: number | null;
}) {
  if (contextKind === "answer") {
    return stepNumber ? `Their answer on screen ${stepNumber}` : "Their answer";
  }

  if (contextKind === "step") {
    return stepNumber ? `Screen ${stepNumber}` : "A screen";
  }

  return "The whole lesson";
}

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
