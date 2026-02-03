import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamStatus } from "../stream-status";
import { type CreatedChapter } from "../types";

export async function getCourseChaptersStep(courseId: number): Promise<CreatedChapter[]> {
  "use step";

  await streamStatus({ status: "started", step: "getExistingChapters" });

  const { data: chapters, error } = await safeAsync(() =>
    prisma.chapter.findMany({
      orderBy: { position: "asc" },
      select: {
        description: true,
        id: true,
        position: true,
        slug: true,
        title: true,
      },
      where: { courseId },
    }),
  );

  if (error || !chapters) {
    await streamStatus({ status: "error", step: "getExistingChapters" });
    throw error ?? new Error("Failed to fetch existing chapters");
  }

  await streamStatus({ status: "completed", step: "getExistingChapters" });

  return chapters;
}
