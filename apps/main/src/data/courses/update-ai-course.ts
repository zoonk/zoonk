import "server-only";
import { type Course, type GenerationStatus, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

export async function updateAICourse(params: {
  courseId: number;
  description?: string;
  imageUrl?: string;
  generationStatus?: GenerationStatus;
}): Promise<SafeReturn<Course>> {
  return safeAsync(() =>
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
}
