import "server-only";
import { type Goal } from "@zoonk/db";
import { loadExamPrepAccess } from "../../../sessions/_utils/plus-only-lessons";

export async function isTestOutPlusOnly(goal: Pick<Goal, "createdAt" | "kind" | "timezone">) {
  const access = await loadExamPrepAccess({ goal });
  return access.trialEnded;
}
