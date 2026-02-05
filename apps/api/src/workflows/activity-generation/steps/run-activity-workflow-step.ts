import { type ActivityKind } from "@zoonk/db";
import { FatalError } from "workflow";
import { backgroundWorkflow } from "../workflows/background-workflow";
import { explanationWorkflow } from "../workflows/explanation-workflow";
import { mechanicsWorkflow } from "../workflows/mechanics-workflow";
import { quizWorkflow } from "../workflows/quiz-workflow";
import { type LessonActivity } from "./get-lesson-activities-step";

export async function runActivityWorkflowStep(
  kind: ActivityKind,
  activities: LessonActivity[],
  lessonId: number,
): Promise<void> {
  "use step";

  // oxlint-disable-next-line typescript-eslint/switch-exhaustiveness-check -- other activity types not yet implemented
  switch (kind) {
    case "background":
      await backgroundWorkflow(activities, lessonId);
      break;
    case "explanation":
      await explanationWorkflow(activities, lessonId);
      break;
    case "mechanics":
      await mechanicsWorkflow(activities, lessonId);
      break;
    case "quiz":
      await quizWorkflow(activities, lessonId);
      break;
    default:
      throw new FatalError(`Activity kind not yet supported for retry: ${kind}`);
  }
}
