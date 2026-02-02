import "server-only";
import { type Chapter, type GenerationStatus, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

export async function updateChapterGenerationStatus(params: {
  chapterId: number;
  generationStatus: GenerationStatus;
  generationRunId?: string | null;
}): Promise<SafeReturn<Pick<Chapter, "id" | "generationStatus">>> {
  const { data, error } = await safeAsync(() =>
    prisma.chapter.update({
      data: {
        generationRunId: params.generationRunId,
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
