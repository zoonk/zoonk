import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";

/**
 * Returns the durable workflow status for one generated course. Delivery apps
 * use this value to decide when their local presentation caches can be expired.
 */
export async function getCourseGenerationStatus({ courseId }: { courseId: string }) {
  if (!isUuid(courseId)) {
    return null;
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  return course?.generationStatus ?? null;
}
