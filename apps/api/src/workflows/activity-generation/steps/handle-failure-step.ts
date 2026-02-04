import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";

export async function handleActivityFailureStep(input: { activityId: bigint }): Promise<void> {
  "use step";

  await safeAsync(() =>
    prisma.activity.update({
      data: { generationStatus: "failed" },
      select: { generationStatus: true, id: true },
      where: { id: input.activityId },
    }),
  );
}
