import { FatalError } from "workflow";
import { getChapterForGeneration } from "@/data/chapters/get-chapter-for-generation";
import { streamStatus } from "../stream-status";

export type ChapterContext = NonNullable<
  Awaited<ReturnType<typeof getChapterForGeneration>>
>;

export async function getChapterStep(
  chapterId: number,
): Promise<ChapterContext> {
  "use step";

  await streamStatus({ status: "started", step: "getChapter" });

  const chapter = await getChapterForGeneration(chapterId);

  if (!chapter) {
    await streamStatus({ status: "error", step: "getChapter" });
    throw new FatalError("Chapter not found");
  }

  await streamStatus({ status: "completed", step: "getChapter" });

  return chapter;
}
