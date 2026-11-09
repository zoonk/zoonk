import { type Goal, type ProfileQuestion } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import {
  PROFILE_QUESTIONS,
  PROFILE_QUESTION_VERSIONS,
  isBiographyQuestion,
} from "./profile-question-contract";

export function getProfileSteps({
  goal,
  answered,
  memoryEnabled,
}: {
  goal: Pick<Goal, "kind" | "details" | "replacesGoalId" | "planRevealedAt">;
  answered: Partial<Record<ProfileQuestion, number>>;
  memoryEnabled: boolean;
}): ProfileQuestion[] {
  if (goal.kind === "explain" || goal.replacesGoalId || goal.planRevealedAt) {
    return [];
  }

  const skipped =
    isJsonObject(goal.details) && Array.isArray(goal.details.answered) ? goal.details.answered : [];

  return PROFILE_QUESTIONS.filter(
    (question) =>
      (answered[question] ?? 0) < PROFILE_QUESTION_VERSIONS[question] &&
      !skipped.includes(question) &&
      (memoryEnabled || !isBiographyQuestion(question)),
  );
}
