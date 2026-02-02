import "server-only";
import { type GenerationStatus, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

export async function updateCourseSuggestionStatus(params: {
  id: number;
  generationStatus: GenerationStatus;
  generationRunId?: string | null;
}): Promise<SafeReturn<void>> {
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
