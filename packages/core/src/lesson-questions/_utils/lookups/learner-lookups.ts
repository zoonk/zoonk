import "server-only";
import {
  type GoalTutorLookUpRequest,
  type GoalTutorLookUpResult,
} from "@zoonk/ai/tasks/v2/tutor/goal-tutor-lookup";
import { type LearnerLookUp } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-lookup-learner";
import { type Goal } from "@zoonk/db";
import { type LinkScope } from "../plan-day-context";
import { lookUpAccount, lookUpCourses, lookUpGoals } from "./learner-account-lookups";
import { lookUpMissions, lookUpWeekly } from "./learner-day-lookups";
import { lookUpProgress } from "./learner-progress-lookup";

/**
 * Reads what a learner lookup asks for (`LEARNER_LOOKUPS`) about the signed-in learner, with the
 * goal the answer is about, which `lookUpTutorData` resolved from their own question. The account
 * readers it reuses read the same signed-in learner the goal belongs to.
 */
export async function lookUpLearnerData({
  linkScope,
  what,
  ...lookup
}: Pick<GoalTutorLookUpRequest, "area" | "query"> & {
  goal: Goal;
  /** What its results may link (see `LinkScope`): what acts on the open goal only when allowed. */
  linkScope: LinkScope;
  what: LearnerLookUp;
}): Promise<GoalTutorLookUpResult> {
  const request = { ...lookup, scope: linkScope };

  switch (what) {
    case "missions":
      return lookUpMissions(request);
    case "goals":
      return lookUpGoals(request);
    case "account":
      return lookUpAccount(request);
    case "weekly":
      return lookUpWeekly(request);
    case "courses":
      return lookUpCourses(request);
    case "progress":
      return lookUpProgress(request);
    default:
      return what satisfies never;
  }
}
