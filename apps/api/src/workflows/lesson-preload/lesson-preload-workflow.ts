import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";

export async function lessonPreloadWorkflow(lessonId: string): Promise<void> {
  "use workflow";

  await lessonGenerationWorkflow(lessonId);
}
