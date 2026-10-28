import "server-only";
import { normalizeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/typed-answer-match";
import { assessPronunciation } from "@zoonk/ai/tasks/v2/language/assess-pronunciation";
import { transcribeSpeech } from "@zoonk/ai/tasks/v2/language/transcribe-speech";
import { logError } from "@zoonk/utils/logger";
import { MAX_SPOKEN_AUDIO_BYTES, isSpokenAudioMediaType } from "../spoken-answer-contract";
import { type SpokenAnswerMatch, matchSpokenAnswer } from "../spoken-answer-match";

export type SpokenAudio = { bytes: Uint8Array; mediaType: string };

export function isValidSpokenAudio(audio: SpokenAudio): boolean {
  return (
    audio.bytes.byteLength > 0 &&
    audio.bytes.byteLength <= MAX_SPOKEN_AUDIO_BYTES &&
    isSpokenAudioMediaType(audio.mediaType)
  );
}

type HeardSentence = { match: SpokenAnswerMatch; transcript: string };

type SentenceCheck = "fast" | "thorough";

type HearInput = {
  audio: SpokenAudio;
  expected: string;
  language: string;
  learnerLanguage?: string;
  userId: string;
};

async function transcribeAndCompare({ audio, expected, language, userId }: HearInput) {
  const { data: transcript } = await transcribeSpeech({
    analytics: { contentScope: "shared", distinctId: userId },
    audio: audio.bytes,
    language,
  });

  return {
    match: matchSpokenAnswer({ expected, heard: transcript.text, language }),
    transcript: transcript.text,
  };
}

async function assessWordByWord(input: HearInput): Promise<HeardSentence> {
  const { data } = await assessPronunciation({
    analytics: { contentScope: "personal", distinctId: input.userId },
    audio: input.audio.bytes,
    expectedText: input.expected,
    language: input.language,
    learnerLanguage: input.learnerLanguage,
    mediaType: input.audio.mediaType,
  });

  const correct = data.words.filter((word) => word.status === "correct").length;

  return {
    match: {
      isCorrect: data.words.length > 0 && correct === data.words.length,
      normalizedHeard: normalizeTypedAnswer(data.transcript),
      score: data.words.length === 0 ? 0 : correct / data.words.length,
      words: data.words.map(({ heard, status, text }) => ({ heard, status, text })),
    },
    transcript: data.transcript,
  };
}

export async function hearSpokenSentence({
  check = "fast",
  ...input
}: HearInput & { check?: SentenceCheck }): Promise<HeardSentence> {
  if (check === "fast") {
    return transcribeAndCompare(input);
  }

  try {
    return await assessWordByWord(input);
  } catch (error) {
    logError("Pronunciation check failed; transcribing instead", error);
    return transcribeAndCompare(input);
  }
}
