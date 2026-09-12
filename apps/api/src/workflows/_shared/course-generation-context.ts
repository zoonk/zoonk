import { type CourseRevisionContext } from "@zoonk/core/workflows/internal/course-curriculum";
import { type Course } from "@zoonk/db";
import { type ChapterContext } from "../chapter-generation/steps/get-chapter-step";
import { type LessonContext } from "../lesson-generation/steps/get-lesson-step";

export function getCourseGenerationFormat(
  format: Course["format"],
): "core" | "language" | "question" | "personalized" {
  if (format === "exam") {
    throw new Error("Exam generation is not supported");
  }

  if (format === "language" || format === "question" || format === "personalized") {
    return format;
  }

  return "core";
}

/** Persisted ownership controls cost; learner prompt text never selects a model. */
export function getCourseGenerationPolicy(course: Pick<Course, "format" | "userId">) {
  if (course.userId || course.format === "personalized") {
    return { model: "openai/gpt-5.6-luna", useFallback: false };
  }

  return { model: "openai/gpt-5.6-sol", useFallback: true };
}

export function getChapterLearningContext(context: ChapterContext) {
  return {
    format: getCourseGenerationFormat(context.course.format),
    level: context.level,
    outcomes: context.outcomes,
    ...(context.course.format === "personalized"
      ? { privateBrief: context.course.discoveryBrief }
      : {}),
  };
}

export function getLessonLearningContext(context: LessonContext) {
  return {
    format: getCourseGenerationFormat(context.chapter.course.format),
    level: context.chapter.level,
    outcomes: context.chapter.outcomes,
    ...(context.chapter.course.format === "personalized"
      ? { privateBrief: context.chapter.course.discoveryBrief }
      : {}),
  };
}

export function getChapterRevisionContext(context: ChapterContext): CourseRevisionContext {
  return {
    contentRevision: context.course.contentRevision,
    courseId: context.courseId,
    ...(context.generationRunId
      ? {
          target: { id: context.id, kind: "chapter" as const },
          workflowRunId: context.generationRunId,
        }
      : {}),
  };
}

export function getLessonRevisionContext(context: LessonContext): CourseRevisionContext {
  return {
    contentRevision: context.chapter.course.contentRevision,
    courseId: context.chapter.courseId,
    ...(context.generationRunId
      ? {
          target: { id: context.id, kind: "lesson" as const },
          workflowRunId: context.generationRunId,
        }
      : {}),
  };
}
