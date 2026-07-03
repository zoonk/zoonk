import { start } from "workflow/api";
import { chapterImagesWorkflow } from "../chapter-images-workflow";

/**
 * Enqueues background chapter artwork generation from inside the course
 * workflow. `start` returns after scheduling the child workflow, so the parent
 * does not wait for the actual image work to finish.
 */
export async function startChapterImagesWorkflowStep(input: { courseId: string }): Promise<string> {
  "use step";

  const run = await start(chapterImagesWorkflow, [input.courseId]);

  return run.runId;
}
