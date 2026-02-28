import { type Activity, type ActivityProgress, prisma } from "@zoonk/db";

function activityAttrs(
  attrs?: Partial<Activity>,
): Omit<Activity, "id" | "createdAt" | "updatedAt"> {
  return {
    description: "Test activity description",
    generationRunId: null,
    generationStatus: "completed",
    isPublished: false,
    kind: "background",
    language: "en",
    lessonId: 0,
    organizationId: 0,
    position: 0,
    title: "Test Activity",
    ...attrs,
  };
}

export async function activityFixture(attrs?: Partial<Activity>) {
  const activity = await prisma.activity.create({ data: activityAttrs(attrs) });
  return activity;
}

export async function activityProgressFixture(
  attrs: Omit<ActivityProgress, "id" | "startedAt"> & {
    startedAt?: Date;
  },
) {
  const activityProgress = await prisma.activityProgress.create({
    data: {
      activityId: attrs.activityId,
      completedAt: attrs.completedAt,
      durationSeconds: attrs.durationSeconds,
      startedAt: attrs.startedAt,
      userId: attrs.userId,
    },
  });

  return activityProgress;
}
