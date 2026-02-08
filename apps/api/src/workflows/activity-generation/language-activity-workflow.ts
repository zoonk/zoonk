import { type LessonActivity } from "./steps/get-lesson-activities-step";

/**
 * Language lesson pipeline (placeholder).
 *
 * TODO: Implement when language AI tasks are available.
 * Expected wave structure:
 * - Wave 1: vocabulary/grammar generation
 * - Wave 2: reading/listening generation
 * - Wave 3: languageStory/languageReview generation
 * - Wave 4: save
 */
export async function languageActivityWorkflow(
  _activities: LessonActivity[],
  _workflowRunId: string,
): Promise<void> {
  // No-op until language AI tasks exist
}
