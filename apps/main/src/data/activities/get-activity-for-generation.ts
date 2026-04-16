import "server-only";
import { getAiGenerationActivityWhere, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";

/**
 * Generate routes turn missing activities into a 404. Returning `null` for
 * malformed ids keeps invalid route params on that path instead of letting
 * Prisma raise a UUID parsing error.
 */
export async function getActivityForGeneration(activityId: string) {
  if (!isUuid(activityId)) {
    return null;
  }

  return prisma.activity.findFirst({
    include: {
      lesson: {
        include: {
          chapter: {
            include: { course: true },
          },
        },
      },
    },
    where: getAiGenerationActivityWhere({
      activityWhere: { id: activityId },
    }),
  });
}
