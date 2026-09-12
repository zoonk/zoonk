import { type CurriculumChapter, type CurriculumLevel } from "@zoonk/ai/tasks/courses/curriculum";
import { type Course } from "@zoonk/db";
import { type CourseContext } from "../course-generation/steps/initialize-course-step";

export function curriculumChapters(level: CurriculumLevel | null): CurriculumChapter[] {
  return Array.from({ length: level === "overview" ? 3 : 1 }, (_, index) => ({
    description: `A focused ${level ?? "question"} outcome ${index + 1}`,
    key: `${level ?? "question"}-${index + 1}`,
    level,
    outcomes: [`Explain ${level ?? "question"} idea ${index + 1}`],
    prerequisiteKeys: index ? [`${level}-1`] : [],
    title: `${level ?? "Answer"} ${index + 1}`,
  }));
}

export function courseContext(course: Course): CourseContext {
  if (!course.organizationId) {
    throw new Error("Reusable course fixture needs an organization");
  }

  const context = {
    contentRevision: course.contentRevision,
    courseId: course.id,
    courseSlug: course.slug,
    courseTitle: course.title,
    generationRunId: course.generationRunId,
    language: course.language,
    organizationId: course.organizationId,
  };

  if (course.format === "language" && course.targetLanguage) {
    return { ...context, format: "language", targetLanguage: course.targetLanguage };
  }

  return { ...context, format: "core", targetLanguage: null };
}
