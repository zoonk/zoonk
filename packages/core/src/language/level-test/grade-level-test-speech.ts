import "server-only";
import { type RefusedUsage } from "../../entitlements/contract";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { type SpokenAudio } from "../../library/language/_utils/hear-spoken-sentence";
import { type SpokenWordResult } from "../../library/language/spoken-answer-match";
import { type LanguageLevelTestView } from "./level-test-contract";

export type GradeLevelTestSpeechResult =
  | RefusedUsage
  | {
      heard: { score: number; transcript: string; words: SpokenWordResult[] };
      status: "ready";
      test: LanguageLevelTestView;
    }
  | {
      status:
        | "invalid"
        | "invalidAudio"
        | "noSpeech"
        | "notFound"
        | "notLanguage"
        | "notReady"
        | "unauthorized";
    };

/** Older clients can submit a sentence they already had on screen. */
export async function gradeLevelTestSpeech({
  goalId,
}: {
  audio: SpokenAudio;
  goalId: string;
}): Promise<GradeLevelTestSpeechResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  return { status: owned.goal.kind === "language" ? "invalid" : "notLanguage" };
}
