import "server-only";
import { prisma } from "@zoonk/db";

export async function getActivityForGeneration(activityId: bigint) {
  return prisma.activity.findUnique({
    select: {
      generationRunId: true,
      generationStatus: true,
      id: true,
      kind: true,
      lesson: {
        select: {
          chapter: {
            select: {
              course: { select: { slug: true } },
              slug: true,
            },
          },
          id: true,
          slug: true,
        },
      },
      position: true,
      title: true,
    },
    where: { id: activityId },
  });
}
