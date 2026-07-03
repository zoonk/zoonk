import { generateChapterImageStep } from "./steps/generate-chapter-image-step";
import { getMissingChapterImageInputsStep } from "./steps/get-missing-chapter-image-inputs-step";

/**
 * Runs optional chapter thumbnail generation away from the user-visible course
 * workflow. This keeps artwork retries and failures from delaying course or
 * first-chapter generation.
 */
export async function chapterImagesWorkflow(courseId: string): Promise<void> {
  "use workflow";

  const chapters = await getMissingChapterImageInputsStep(courseId);

  await Promise.allSettled(chapters.map((chapter) => generateChapterImageStep(chapter)));
}
