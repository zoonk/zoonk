import "server-only";
import {
  type LanguageViewGoalResult,
  resolveLanguageViewGoal,
} from "../../view-models/language/_utils/language-view-goal";
import { findFreshMistakePattern } from "./find-fresh-pattern";

type NoticedPatternResult =
  | Exclude<LanguageViewGoalResult, { status: "ready" }>
  | { pattern: Awaited<ReturnType<typeof findFreshMistakePattern>>; status: "ready" };

/** The notebook's newest pattern for a language goal, a finding of typos included. */
export async function getNoticedPattern(
  input: { goalId?: string } = {},
): Promise<NoticedPatternResult> {
  "use cache: private";

  const loaded = await resolveLanguageViewGoal(input.goalId);

  if (loaded.status !== "ready") {
    return loaded;
  }

  const { goal, userId } = loaded.context;

  const pattern = await findFreshMistakePattern({
    goalId: goal.id,
    language: goal.targetLanguage,
    userId,
  });

  return { pattern, status: "ready" };
}
