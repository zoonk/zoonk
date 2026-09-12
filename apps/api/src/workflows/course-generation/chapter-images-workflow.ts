import { createHook } from "workflow";
import { generateChapterImageStep } from "./steps/generate-chapter-image-step";
import { getCurriculumCourseStep } from "./steps/get-curriculum-course-step";
import { getMissingChapterImageInputsStep } from "./steps/get-missing-chapter-image-inputs-step";

/**
 * Runs required chapter thumbnail generation away from the user-visible course
 * workflow. This keeps artwork retries and failures from delaying course or
 * first-chapter generation.
 */
export async function chapterImagesWorkflow(courseId: string): Promise<void> {
  "use workflow";

  const course = await getCurriculumCourseStep(courseId);
  using claim = createHook({ token: `chapter-images:${courseId}:${course.contentRevision}` });

  if (await claim.getConflict()) {
    return;
  }

  const chapters = await getMissingChapterImageInputsStep(courseId);

  const results = await Promise.allSettled(
    chapters.map((chapter) => generateChapterImageStep(chapter)),
  );

  const failed = results.find((result) => result.status === "rejected");

  if (failed?.status === "rejected") {
    throw failed.reason;
  }
}
