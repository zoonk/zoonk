import { type LanguageConversation } from "@zoonk/db";

export function isPlusOnlyLiveCall(kind: LanguageConversation["kind"]): boolean {
  return kind === "checkpoint" || kind === "examSpeaking";
}
