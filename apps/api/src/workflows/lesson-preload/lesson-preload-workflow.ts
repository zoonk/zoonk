import { activityGenerationWorkflow } from "@/workflows/activity-generation/activity-generation-workflow";
import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";

export async function lessonPreloadWorkflow(lessonId: string): Promise<void> {
  "use workflow";

  const lessonGenerationResult = await lessonGenerationWorkflow(lessonId);

  if (lessonGenerationResult === "ready") {
    await activityGenerationWorkflow(lessonId);
  }
}
