import { type LanguageConversation } from "@zoonk/db";

/** Required challenges and certificate exam speaking tasks come with Plus. */
export function isPlusOnlyLiveCall(kind: LanguageConversation["kind"]): boolean {
  return kind === "checkpoint" || kind === "examSpeaking";
}
