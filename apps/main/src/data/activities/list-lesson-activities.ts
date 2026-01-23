import "server-only";
import { prisma } from "@zoonk/db";
import { cache } from "react";
import type { ActivityKind } from "@zoonk/db";

export type ActivityForList = {
  id: bigint;
  kind: ActivityKind;
  title: string | null;
  description: string | null;
  position: number;
};

const cachedListLessonActivities = cache(
  async (lessonId: number): Promise<ActivityForList[]> =>
    prisma.activity.findMany({
      orderBy: { position: "asc" },
      select: {
        description: true,
        id: true,
        kind: true,
        position: true,
        title: true,
      },
      where: { isPublished: true, lessonId },
    }),
);

export function listLessonActivities(params: { lessonId: number }): Promise<ActivityForList[]> {
  return cachedListLessonActivities(params.lessonId);
}
