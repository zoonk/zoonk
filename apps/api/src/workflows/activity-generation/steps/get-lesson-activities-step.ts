import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";
import { streamStatus } from "../stream-status";

async function getLessonActivities(lessonId: number) {
  const activities = await prisma.activity.findMany({
    orderBy: { position: "asc" },
    select: {
      _count: { select: { steps: true } },
      description: true,
      generationStatus: true,
      id: true,
      kind: true,
      language: true,
      lesson: {
        select: {
          chapter: {
            select: {
              course: {
                select: {
                  organization: { select: { slug: true } },
                  targetLanguage: true,
                  title: true,
                },
              },
              title: true,
            },
          },
          description: true,
          kind: true,
          title: true,
        },
      },
      title: true,
    },
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
    await streamStatus({ status: "error", step: "getLessonActivities" });
    throw error;
  }

  if (activities.length === 0) {
    await streamStatus({ status: "error", step: "getLessonActivities" });
    throw new FatalError("No activities found for lesson");
  }

  await streamStatus({ status: "completed", step: "getLessonActivities" });

  return activities;
}
