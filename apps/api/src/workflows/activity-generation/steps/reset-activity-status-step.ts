import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

export async function resetActivityStatusStep(activityId: bigint): Promise<void> {
  "use step";

  const { error } = await safeAsync(() =>
    prisma.activity.update({
      data: { generationRunId: null, generationStatus: "pending" },
      select: { id: true },
      where: { id: activityId },
    }),
  );

  if (error) {
    throw error;
  }
}
