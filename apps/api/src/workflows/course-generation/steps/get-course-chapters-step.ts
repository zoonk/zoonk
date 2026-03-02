import { type Chapter, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { streamError, streamStatus } from "../stream-status";

export async function getCourseChaptersStep(courseId: number): Promise<Chapter[]> {
  "use step";

  await streamStatus({ status: "started", step: "getExistingChapters" });

  const { data: chapters, error } = await safeAsync(() =>
    prisma.chapter.findMany({
      orderBy: { position: "asc" },
      where: { courseId },
    }),
  );

  if (error || !chapters) {
    await streamError({ reason: "dbFetchFailed", step: "getExistingChapters" });
    throw error ?? new Error("Failed to fetch existing chapters");
  }

  await streamStatus({ status: "completed", step: "getExistingChapters" });

  return chapters;
}
