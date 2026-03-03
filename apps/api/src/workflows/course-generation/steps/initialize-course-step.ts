import { type CourseSuggestion, prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { safeAsync } from "@zoonk/utils/error";
import { ensureLocaleSuffix, normalizeString, toSlug } from "@zoonk/utils/string";
import { streamError, streamStatus } from "../stream-status";

export type CourseContext = {
  courseId: number;
  courseSlug: string;
  courseTitle: string;
  language: string;
  organizationId: number;
  targetLanguage: string | null;
};

export async function initializeCourseStep(input: {
  suggestion: CourseSuggestion;
  workflowRunId: string;
}): Promise<CourseContext> {
  "use step";

  await streamStatus({ status: "started", step: "initializeCourse" });

  const { suggestion, workflowRunId } = input;

  const { data: aiOrg, error: orgError } = await safeAsync(() =>
    prisma.organization.findUniqueOrThrow({
      where: { slug: AI_ORG_SLUG },
    }),
  );

  if (orgError || !aiOrg) {
    await streamError({ reason: "dbFetchFailed", step: "initializeCourse" });
    throw orgError ?? new Error("AI organization not found");
  }

  // Update course suggestion status to running
  const { error: updateError } = await safeAsync(() =>
    prisma.courseSuggestion.update({
      data: {
        generationRunId: workflowRunId,
        generationStatus: "running",
      },
      where: { id: suggestion.id },
    }),
  );

  if (updateError) {
    await streamError({ reason: "dbSaveFailed", step: "initializeCourse" });
    throw updateError;
  }

  // Create the course
  const slug = ensureLocaleSuffix(toSlug(suggestion.title), suggestion.language);
  const normalizedTitle = normalizeString(suggestion.title);

  const { data: course, error: createError } = await safeAsync(() =>
    prisma.course.create({
      data: {
        generationRunId: workflowRunId,
        generationStatus: "running",
        isPublished: true,
        language: suggestion.language,
        normalizedTitle,
        organizationId: aiOrg.id,
        slug,
        targetLanguage: suggestion.targetLanguage,
        title: suggestion.title,
      },
    }),
  );

  if (createError || !course) {
    await streamError({ reason: "dbSaveFailed", step: "initializeCourse" });
    throw createError ?? new Error("Failed to create course");
  }

  await streamStatus({ status: "completed", step: "initializeCourse" });

  return {
    courseId: course.id,
    courseSlug: course.slug,
    courseTitle: suggestion.title,
    language: suggestion.language,
    organizationId: aiOrg.id,
    targetLanguage: suggestion.targetLanguage,
  };
}
