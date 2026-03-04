import { completeActivityStep } from "../steps/complete-activity-step";
import { generateGrammarContentStep } from "../steps/generate-grammar-content-step";
import { type LessonActivity } from "../steps/get-lesson-activities-step";

export async function grammarActivityWorkflow(
  activities: LessonActivity[],
  workflowRunId: string,
  concepts: string[],
  neighboringConcepts: string[],
): Promise<void> {
  "use workflow";

  await generateGrammarContentStep(activities, workflowRunId, concepts, neighboringConcepts);
  await completeActivityStep(activities, workflowRunId, "grammar");
}
