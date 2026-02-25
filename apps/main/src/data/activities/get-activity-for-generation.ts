import "server-only";
import { prisma } from "@zoonk/db";

export async function getActivityForGeneration(activityId: bigint) {
  return prisma.activity.findUnique({
    include: {
      lesson: {
        include: {
          chapter: {
            include: { course: true },
          },
        },
      },
    },
    where: { id: activityId },
  });
}
