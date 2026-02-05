import { type ActivityKind, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { FatalError } from "workflow";

export async function getActivityInfoStep(
  activityId: bigint,
): Promise<{ kind: ActivityKind; lessonId: number }> {
  "use step";

  const { data: activity, error } = await safeAsync(() =>
    prisma.activity.findUnique({
      select: { kind: true, lessonId: true },
      where: { id: activityId },
    }),
  );

  if (error) {
    throw error;
  }

  if (!activity) {
    throw new FatalError(`Activity ${activityId} not found`);
  }

  return activity;
}
