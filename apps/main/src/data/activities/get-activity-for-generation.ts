import "server-only";
import { getAiGenerationActivityWhere, prisma } from "@zoonk/db";

export async function getActivityForGeneration(activityId: bigint) {
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
