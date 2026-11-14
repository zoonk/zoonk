import { startOnce } from "../_shared/run-token";
import { getChapterMindMapToken } from "./chapter-mind-map-input";
import { chapterMindMapWorkflow } from "./chapter-mind-map-workflow";
import { listOwedMindMapRedrawsStep } from "./steps/chapter-mind-map-steps";

export async function startOwedMindMapRedraws(): Promise<void> {
  const chapters = await listOwedMindMapRedrawsStep();

  await Promise.all(
    chapters.map((chapterId) =>
      startOnce(
        chapterMindMapWorkflow,
        [{ chapterId, redraw: true }],
        getChapterMindMapToken(chapterId),
      ),
    ),
  );
}
