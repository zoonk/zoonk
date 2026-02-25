import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { safeAsync } from "@zoonk/utils/error";
import { ensureLocaleSuffix, normalizeString, toSlug } from "@zoonk/utils/string";
import { streamError, streamStatus } from "../stream-status";
import { type CourseContext, type CourseSuggestionData } from "../types";

export async function initializeCourseStep(input: {
  suggestion: CourseSuggestionData;
  workflowRunId: string;
}): Promise<CourseContext> {
  "use step";

  await streamStatus({ status: "started", step: "initializeCourse" });

  const { suggestion, workflowRunId } = input;

  const aiOrg = await prisma.organization.findUniqueOrThrow({
    select: { id: true },
    where: { slug: AI_ORG_SLUG },
  });

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
      select: { id: true, slug: true },
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
