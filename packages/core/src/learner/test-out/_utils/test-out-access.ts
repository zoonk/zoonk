import "server-only";
import { type Goal } from "@zoonk/db";
import { loadExamPrepAccess } from "../../../sessions/_utils/plus-only-lessons";

/**
 * Whether a chapter's test-out comes with Plus: past a free exam plan's first week, since it takes
 * the learner past lessons only Plus opens and writes its questions with AI.
 */
export async function isTestOutPlusOnly(goal: Pick<Goal, "createdAt" | "kind" | "timezone">) {
  const access = await loadExamPrepAccess({ goal });
  return access.trialEnded;
}
