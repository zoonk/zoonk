export const LIVE_CONVERSATION_MODEL = "openai/gpt-live-1";

/**
 * Brazilian Portuguese has natural voices of its own; GPT-Live's others are English with a regional
 * accent, so every other language keeps Marin, the default.
 */
const LIVE_CONVERSATION_VOICES: Readonly<Partial<Record<string, string>>> = { pt: "bossa" };
const DEFAULT_LIVE_CONVERSATION_VOICE = "marin";

export function getLiveConversationVoice(targetLanguage: string): string {
  const language = targetLanguage.split("-")[0] ?? targetLanguage;
  return LIVE_CONVERSATION_VOICES[language] ?? DEFAULT_LIVE_CONVERSATION_VOICE;
}
