import "server-only";

import type { Chapter } from "@zoonk/db";
import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

type UpdateParams = {
  chapterId: number;
  generationStatus: "pending" | "running" | "completed" | "failed";
  generationRunId?: string;
};

type UpdatedChapter = Pick<Chapter, "id" | "generationStatus">;

export async function updateChapterGenerationStatus(
  params: UpdateParams,
): Promise<SafeReturn<UpdatedChapter>> {
  const { data, error } = await safeAsync(() =>
    prisma.chapter.update({
      data: {
        generationRunId: params.generationRunId ?? null,
        generationStatus: params.generationStatus,
      },
      select: { generationStatus: true, id: true },
      where: { id: params.chapterId },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}
