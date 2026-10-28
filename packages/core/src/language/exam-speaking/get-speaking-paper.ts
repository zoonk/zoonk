import "server-only";
import {
  type LanguageViewGoalResult,
  resolveLanguageViewGoal,
} from "../../view-models/language/_utils/language-view-goal";
import { hasSpeakingAccess, loadSpeakingPaper } from "./_utils/exam-speaking-setup";
import { type SpeakingPaperView } from "./speaking-contract";

type SpeakingPaperResult =
  | Exclude<LanguageViewGoalResult, { status: "ready" }>
  | { goalId: string; paper: SpeakingPaperView | null; status: "ready" };

export async function getSpeakingPaper(
  input: { goalId?: string } = {},
): Promise<SpeakingPaperResult> {
  "use cache: private";

  const loaded = await resolveLanguageViewGoal(input.goalId);

  if (loaded.status !== "ready") {
    return loaded;
  }

  const { goal } = loaded.context;
  const open = await hasSpeakingAccess();

  const paper = await loadSpeakingPaper({ access: open ? "open" : "plusRequired", goal });

  return { goalId: goal.id, paper, status: "ready" };
}
