import "server-only";
import { normalizeTypedAnswer } from "@zoonk/ai/tasks/grading/typed-answer-match";
import { assessPronunciation } from "@zoonk/ai/tasks/language/assess-pronunciation";
import {
  NO_SPEECH_CHECK_MODEL,
  type TranscriptionModelId,
  transcribeSpeech,
} from "@zoonk/ai/tasks/language/transcribe-speech";
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

/** Null when the model failed, and "" when it heard no words. */
async function transcribe(
  { audio, language, userId }: HearInput,
  model?: TranscriptionModelId,
): Promise<string | null> {
  const { data: text, error } = await safeAsync(async () => {
    const { data } = await transcribeSpeech({
      analytics: { contentScope: "shared", distinctId: userId },
      audio: audio.bytes,
      language,
      model,
    });

    return data.text;
  });

  if (error) {
    logError(`Transcription with ${model ?? "the default model"} failed`, error);
    return null;
  }

  return normalizeTypedAnswer(text) ? text : "";
}

/**
 * The word-by-word judge writes the expected sentence for silence, noise or a cough, so only
 * transcribers decide that nobody spoke, and it takes both: each alone misses some real
 * one-syllable words. With both down, the judge grades alone.
 */
async function heardNoWords(input: HearInput, transcript: string | null): Promise<boolean> {
  const check = await transcribe(input, NO_SPEECH_CHECK_MODEL);
  return check === null ? transcript === "" : check === "";
}

function noSpeech({ expected, language }: HearInput): HeardSentence {
  return { match: matchSpokenAnswer({ expected, heard: "", language }), transcript: "" };
}

async function compareTranscript({
  expected,
  language,
  romanization,
  transcript,
  verifyExactReading,
}: HearInput & { transcript: string; verifyExactReading?: boolean }) {
  const input = { expected, heard: transcript, language };
  const match = matchSpokenAnswer(input);
  const heard = { match, transcript };

  if (match.isCorrect) {
    return { heard, listen: Boolean(verifyExactReading) };
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
      transcript,
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
    const [judged, transcript] = await Promise.all([
      safeAsync(() => assessWordByWord(input)),
      transcribe(input),
    ]);

    if (!transcript && (await heardNoWords(input, transcript))) {
      return noSpeech(input);
    }

    if (!judged.error) {
      return judged.data;
    }

    logError("The thorough speech check failed; trying transcription", judged.error);

    if (!transcript) {
      throw judged.error;
    }

    const { heard, listen } = await compareTranscript({ ...input, transcript, verifyExactReading });

    if (listen) {
      throw judged.error;
    }

    return heard;
  }

  const transcript = await transcribe(input);

  if (!transcript) {
    return (await heardNoWords(input, transcript)) ? noSpeech(input) : assessWordByWord(input);
  }

  const { heard, listen } = await compareTranscript({ ...input, transcript });
  return listen ? assessWordByWord({ ...input, transcriberHeard: transcript }) : heard;
}
