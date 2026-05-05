import {
  type ChapterImageInput,
  generateChapterImageStep,
} from "./steps/generate-chapter-image-step";

/**
 * Runs optional chapter thumbnail generation away from the user-visible course
 * workflow. This keeps artwork retries and failures from delaying course or
 * first-chapter generation.
 */
export async function chapterImagesWorkflow(chapters: ChapterImageInput[]): Promise<void> {
  "use workflow";

  await Promise.allSettled(chapters.map((chapter) => generateChapterImageStep(chapter)));
}
