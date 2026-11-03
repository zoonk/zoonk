import { type LanguageConversation } from "@zoonk/db";
import { getLongestCallSeconds } from "../../../entitlements/limits";

const SECONDS_PER_MINUTE = 60;

/** Checkpoints, exam tasks and practice lengths past the free plan's come with Plus. */
export function isPlusOnlyLiveCall({
  kind,
  minutes,
}: Pick<LanguageConversation, "kind" | "minutes">): boolean {
  return (
    kind === "checkpoint" ||
    kind === "examSpeaking" ||
    (kind === "practice" && minutes * SECONDS_PER_MINUTE > getLongestCallSeconds("free"))
  );
}
