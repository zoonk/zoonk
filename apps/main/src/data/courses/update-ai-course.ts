import "server-only";

import { prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

type UpdateParams = {
  courseId: number;
  description?: string;
  imageUrl?: string;
  generationStatus?: "pending" | "running" | "completed" | "failed";
};

export async function updateAICourse(
  params: UpdateParams,
): Promise<SafeReturn<void>> {
  const { error } = await safeAsync(() =>
    prisma.course.update({
      data: {
        ...(params.description !== undefined && {
          description: params.description,
        }),
        ...(params.imageUrl !== undefined && { imageUrl: params.imageUrl }),
        ...(params.generationStatus !== undefined && {
          generationStatus: params.generationStatus,
        }),
      },
      where: { id: params.courseId },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: undefined, error: null };
}
