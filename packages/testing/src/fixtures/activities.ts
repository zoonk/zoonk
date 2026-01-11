import { type Activity, type ActivityProgress, prisma } from "@zoonk/db";

export function activityAttrs(
  attrs?: Partial<Activity>,
): Omit<
  Activity,
  "id" | "createdAt" | "updatedAt" | "inventory" | "winCriteria"
> {
  return {
    description: "Test activity description",
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
  attrs: Omit<ActivityProgress, "id" | "startedAt" | "inventoryFinal"> & {
    startedAt?: Date;
  },
) {
  const activityProgress = await prisma.activityProgress.create({
    data: {
      activityId: attrs.activityId,
      completedAt: attrs.completedAt,
      durationSeconds: attrs.durationSeconds,
      passed: attrs.passed,
      startedAt: attrs.startedAt,
      userId: attrs.userId,
    },
  });

  return activityProgress;
}
