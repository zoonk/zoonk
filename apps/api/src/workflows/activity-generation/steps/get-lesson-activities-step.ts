import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";
import { streamError, streamStatus } from "../stream-status";

async function getLessonActivities(lessonId: number) {
  const activities = await prisma.activity.findMany({
    include: {
      _count: { select: { steps: true } },
      lesson: {
        include: {
          chapter: {
            include: {
              course: { include: { organization: true } },
            },
          },
        },
      },
    },
    orderBy: { position: "asc" },
    where: { lessonId },
  });

  // Convert bigint IDs to number for JSON serialization in workflow steps
  return activities.map((activity) => ({ ...activity, id: Number(activity.id) }));
}

export type LessonActivity = Awaited<ReturnType<typeof getLessonActivities>>[number];

export async function getLessonActivitiesStep(lessonId: number): Promise<LessonActivity[]> {
  "use step";

  await streamStatus({ status: "started", step: "getLessonActivities" });

  const { data: activities, error } = await safeAsync(() => getLessonActivities(lessonId));

  if (error) {
    await streamError({ reason: "dbFetchFailed", step: "getLessonActivities" });
    throw error;
  }

  if (activities.length === 0) {
    await streamError({ reason: "noSourceData", step: "getLessonActivities" });
    throw new FatalError("No activities found for lesson");
  }

  await streamStatus({ status: "completed", step: "getLessonActivities" });

  return activities;
}
