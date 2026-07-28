import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { type CoursePromptWithCourse } from "./_utils/course-prompt-types";

/**
 * Finds a generation prompt by its durable identifier. Generation clients use
 * this resource instead of repeating prompt classification, which keeps every
 * delivery layer and the workflow aligned on the same persisted request.
 */
export async function getCoursePromptById({
  id,
}: {
  id: string;
}): Promise<CoursePromptWithCourse | null> {
  if (!isUuid(id)) {
    return null;
  }

  return prisma.coursePrompt.findUnique({ include: { course: true }, where: { id } });
}
