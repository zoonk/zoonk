import "server-only";
import { type Goal } from "@zoonk/db";
import {
  type EntitlementViewer,
  getEntitlementViewer,
} from "../../entitlements/_utils/entitlement-viewer";
import { getExamPrepAccess as getPlanExamPrep } from "../../entitlements/limits";
import { type ExamPrepAccess, getExamPrepAccess } from "./exam-access";

export async function loadExamPrepAccess({
  goal,
  readViewer = getEntitlementViewer,
}: {
  goal: Pick<Goal, "kind">;
  readViewer?: () => Promise<EntitlementViewer | null>;
  timeZone?: string | null;
  today?: Date;
}): Promise<ExamPrepAccess> {
  const viewer = goal.kind === "exam" ? await readViewer() : null;
  return getExamPrepAccess({ examPrep: viewer ? getPlanExamPrep(viewer.tier) : null, goal });
}

export type PlusLesson = { title: string };
