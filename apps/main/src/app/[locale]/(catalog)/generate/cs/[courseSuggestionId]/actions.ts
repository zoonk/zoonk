"use server";

import { prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { start } from "workflow/api";
import { getCourseSuggestionById } from "@/data/courses/get-course-suggestion";
import { redirect } from "@/i18n/navigation";
import { courseGenerationWorkflow } from "@/workflows/course-generation/course-generation-workflow";

type StartCourseGenerationParams = {
  courseSuggestionId: number;
  title: string;
  locale: string;
};

export async function startCourseGeneration(
  params: StartCourseGenerationParams,
) {
  // 1. Validate suggestion exists
  const suggestion = await getCourseSuggestionById(params.courseSuggestionId);
  if (!suggestion) {
    throw new Error("Suggestion not found");
  }

  // 2. Validate title matches one of the suggestions
  const suggestions = suggestion.suggestions as { title: string }[];
  const isValidTitle = suggestions.some((s) => s.title === params.title);
  if (!isValidTitle) {
    throw new Error("Invalid title - must match a pre-generated suggestion");
  }

  // 3. Get the AI organization
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: AI_ORG_SLUG },
  });

  const slug = toSlug(params.title);
  const normalizedTitle = normalizeString(params.title);

  // 4. Try to create the course with "generating" status
  // This prevents duplicates via the unique constraint
  type CourseResult = { generationStatus: string; id: number; slug: string };
  let course: CourseResult | undefined;
  try {
    course = await prisma.course.create({
      data: {
        generationStatus: "generating",
        isPublished: true,
        language: params.locale,
        normalizedTitle,
        organizationId: org.id,
        slug,
        title: params.title,
      },
      select: { generationStatus: true, id: true, slug: true },
    });
  } catch (error) {
    // If unique constraint violation, find the existing course
    if ((error as { code?: string }).code === "P2002") {
      const existing = await prisma.course.findFirst({
        select: { generationStatus: true, id: true, slug: true },
        where: {
          language: params.locale,
          organizationId: org.id,
          slug,
        },
      });

      if (existing) {
        // If already completed, redirect to the course page
        if (existing.generationStatus === "completed") {
          redirect({ href: `/b/ai/c/${existing.slug}`, locale: params.locale });
        }
        // If still generating, return the existing course ID
        course = existing;
      }
    } else {
      throw error;
    }
  }

  if (!course) {
    throw new Error("Failed to create or find course");
  }

  // 5. Only start workflow if we just created the course (not if it was already generating)
  if (course.generationStatus === "generating") {
    await start(courseGenerationWorkflow, [
      {
        courseId: course.id,
        courseSuggestionId: params.courseSuggestionId,
        locale: params.locale,
        title: params.title,
      },
    ]);
  }

  return { courseId: course.id, slug: course.slug };
}

type CheckCourseStatusParams = {
  locale: string;
  slug: string;
};

type CourseStatus = {
  exists: boolean;
  status: "generating" | "completed" | null;
};

export async function checkCourseStatus(
  params: CheckCourseStatusParams,
): Promise<CourseStatus> {
  const course = await prisma.course.findFirst({
    select: { generationStatus: true },
    where: {
      language: params.locale,
      organization: { slug: AI_ORG_SLUG },
      slug: params.slug,
    },
  });

  if (!course) {
    return { exists: false, status: null };
  }

  return {
    exists: true,
    status: course.generationStatus as "generating" | "completed",
  };
}
