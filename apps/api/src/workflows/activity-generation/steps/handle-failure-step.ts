import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

export async function handleActivityFailureStep(input: { activityId: string }): Promise<void> {
  "use step";

  logError("[Activity Failure]", `activityId: ${input.activityId}`);

  await safeAsync(() =>
    prisma.activity.update({
      data: { generationStatus: "failed" },
      where: { id: input.activityId },
    }),
  );
}
