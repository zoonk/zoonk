import "server-only";

import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

type UpdateParams = {
  id: number;
  generationStatus: "pending" | "running" | "completed" | "failed";
  generationRunId?: string | null;
};

export async function updateCourseSuggestionStatus(
  params: UpdateParams,
): Promise<SafeReturn<void>> {
  const { error } = await safeAsync(() =>
    prisma.courseSuggestion.update({
      data: {
        generationRunId: params.generationRunId,
        generationStatus: params.generationStatus,
      },
      where: { id: params.id },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: undefined, error: null };
}
