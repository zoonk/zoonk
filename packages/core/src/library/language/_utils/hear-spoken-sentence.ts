import "server-only";
import { normalizeTypedAnswer } from "@zoonk/ai/tasks/grading/typed-answer-match";
import { assessPronunciation } from "@zoonk/ai/tasks/language/assess-pronunciation";
import { transcribeSpeech } from "@zoonk/ai/tasks/language/transcribe-speech";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import {
  MAX_SPOKEN_ANSWER_DURATION_MS,
  MAX_SPOKEN_AUDIO_BYTES,
  isSpokenAudioMediaType,
} from "../spoken-answer-contract";
import { type SpokenAnswerMatch, matchSpokenAnswer } from "../spoken-answer-match";
import { readPlayedMs } from "./played-length";
import { needsSurnameCheck, transcriptReading } from "./transcript-reading";

export type SpokenAudio = { bytes: Uint8Array; mediaType: string };

export async function isValidSpokenAudio(audio: SpokenAudio): Promise<boolean> {
  if (
    audio.bytes.byteLength === 0 ||
    audio.bytes.byteLength > MAX_SPOKEN_AUDIO_BYTES ||
    !isSpokenAudioMediaType(audio.mediaType)
  ) {
    return false;
  }

  const playedMs = await readPlayedMs(audio.bytes);
  return playedMs !== null && playedMs <= MAX_SPOKEN_ANSWER_DURATION_MS;
}

type HeardSentence = { match: SpokenAnswerMatch; transcript: string };

type SentenceCheck = "fast" | "thorough";

type HearInput = {
  audio: SpokenAudio;
  expected: string;
  language: string;
  learnerLanguage?: string;
  romanization?: string | null;
  userId: string;
};

async function transcribeAndCompare({
  audio,
  expected,
  language,
  romanization,
  userId,
  verifyExactReading,
}: HearInput & { verifyExactReading?: boolean }) {
  const { data: transcript } = await transcribeSpeech({
    analytics: { contentScope: "shared", distinctId: userId },
    audio: audio.bytes,
    language,
  });

  const input = { expected, heard: transcript.text, language };
  const match = matchSpokenAnswer(input);
  const heard = { match, transcript: transcript.text };

  if (!match.normalizedHeard || match.isCorrect) {
    return { heard, listen: match.isCorrect && Boolean(verifyExactReading) };
  }

  const reading = await transcriptReading({ ...input, romanization });

  if (reading !== "equivalent") {
    return { heard, listen: reading === "listen" };
  }

  return {
    heard: {
      match: {
        ...match,
        isCorrect: true,
        score: 1,
        words: match.words.map(({ text }) => ({ heard: null, status: "correct" as const, text })),
      },
      transcript: transcript.text,
    },
    listen: false,
  };
}

async function assessWordByWord(
  input: HearInput & { transcriberHeard?: string },
): Promise<HeardSentence> {
  const { data } = await assessPronunciation({
    analytics: { contentScope: "personal", distinctId: input.userId },
    audio: input.audio.bytes,
    expectedText: input.expected,
    language: input.language,
    learnerLanguage: input.learnerLanguage,
    mediaType: input.audio.mediaType,
    romanization: input.romanization,
    transcriberHeard: input.transcriberHeard,
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

/** The providers back each other up, including for languages the transcriber refuses. */
export async function hearSpokenSentence({
  check = "fast",
  ...input
}: HearInput & { check?: SentenceCheck }): Promise<HeardSentence> {
  // A transcript can spell a surname correctly even when the speaker used its ordinary reading.
  const verifyExactReading = await needsSurnameCheck(input);

  if (check === "thorough" || verifyExactReading) {
    const { data, error } = await safeAsync(() => assessWordByWord(input));

    if (!error) {
      return data;
    }

    logError("The thorough speech check failed; trying transcription", error);
    const { heard, listen } = await transcribeAndCompare({ ...input, verifyExactReading });

    if (listen) {
      throw error;
    }

    return heard;
  }

  const { data, error } = await safeAsync(() => transcribeAndCompare(input));

  if (error) {
    logError("The fast speech check failed; trying the word-by-word check", error);
    return assessWordByWord(input);
  }

  const { heard, listen } = data;
  return listen ? assessWordByWord({ ...input, transcriberHeard: heard.transcript }) : heard;
}
