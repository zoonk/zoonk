import { activityGenerationWorkflow } from "@/workflows/activity-generation/activity-generation-workflow";
import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";

export async function lessonPreloadWorkflow(lessonId: number): Promise<void> {
  "use workflow";
  await lessonGenerationWorkflow(lessonId);
  await activityGenerationWorkflow(lessonId);
}
