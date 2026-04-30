import { getBlockingLessonGenerationPrerequisite } from "@zoonk/core/lessons/generation-prerequisites";
import { type LessonContext } from "./get-lesson-step";

/**
 * Workflow functions cannot query Prisma directly, so this step keeps the
 * prerequisite guard in the Node.js runtime before any lesson is marked running.
 */
export async function getBlockingGenerationPrerequisiteStep(context: LessonContext) {
  "use step";

  return getBlockingLessonGenerationPrerequisite(context);
}
