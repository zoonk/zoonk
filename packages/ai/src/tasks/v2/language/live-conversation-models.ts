/**
 * The voice model for live calls: GPT-Live on AI Gateway, which the browser reaches over the native
 * Live WebSocket (`session.start`, PCM16 at 24 kHz, transcripts as `session.input_transcript.delta`
 * and `session.output_transcript.delta`). It listens and speaks at the same time, so the learner can
 * interrupt, and costs $0.05 per minute of session, silence included. The gateway supports client
 * delegation only, so the model has no tools: a separate text model marks objectives from the
 * transcript (`conversation-objectives`), and the app tells GPT-Live which are done.
 *
 * In the `live-conversation` eval (27 Sep 2026: six scripted calls spoken by text-to-speech, A2
 * renting and arrival for a Portuguese speaker, B1 work in Brazilian Portuguese and C1 in Spain
 * Spanish for English speakers, IELTS and TOEFL speaking mocks) it scored 8.65 (8.25 English, 8.85
 * Portuguese learners), first words 1.1s after the learner stopped (1.4s p95), once replies were
 * held to two short sentences, Portuguese calls got the Bossa voice and the opening cue named the
 * line; before that it scored 7.90 to 8.02, and one TOEFL mock took 30s to open.
 * gpt-realtime-2.1, which it replaced, scored 8.54 in text mode on the gateway's normalized route
 * with a tool call per objective.
 */
export const LIVE_CONVERSATION_MODEL = "openai/gpt-live-1";

/**
 * GPT-Live's voices by the language of the call. Brazilian Portuguese has natural voices of its own
 * (Bossa and Tempo); the others are English with a regional accent, so every other language keeps
 * Marin, the default, which speaks them all.
 */
const LIVE_CONVERSATION_VOICES: Readonly<Partial<Record<string, string>>> = { pt: "bossa" };
const DEFAULT_LIVE_CONVERSATION_VOICE = "marin";

export function getLiveConversationVoice(targetLanguage: string): string {
  const language = targetLanguage.split("-")[0] ?? targetLanguage;
  return LIVE_CONVERSATION_VOICES[language] ?? DEFAULT_LIVE_CONVERSATION_VOICE;
}
