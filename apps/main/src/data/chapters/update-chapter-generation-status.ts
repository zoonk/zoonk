import "server-only";

import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

type UpdateParams = {
  chapterId: number;
  generationStatus: "pending" | "running" | "completed" | "failed";
  generationRunId?: string;
};

export async function updateChapterGenerationStatus(
  params: UpdateParams,
): Promise<SafeReturn<void>> {
  const { error } = await safeAsync(() =>
    prisma.chapter.update({
      data: {
        generationRunId: params.generationRunId ?? null,
        generationStatus: params.generationStatus,
      },
      where: { id: params.chapterId },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: undefined, error: null };
}
