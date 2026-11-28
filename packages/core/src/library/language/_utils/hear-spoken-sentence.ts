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
 * The word-by-word judge writes the expected sentence for silence, noise or a cough, so it grades a
 * recording whose transcript has none of the sentence's words only once this check's model hears
 * speech: each transcriber alone misses some real one-syllable words. Without the check's answer
 * nothing tells silence from speech, so the answer isn't graded.
 */
function spoke(check: string | null): boolean {
  if (check === null) {
    throw new Error("The no-speech check couldn't listen to the recording");
  }

  return check !== "";
}

function noSpeech({ expected, language }: HearInput): HeardSentence {
  return { match: matchSpokenAnswer({ expected, heard: "", language }), transcript: "" };
}

/**
 * The default transcriber wrote words for every real sentence we tried and heard nothing only in
 * some one-word answers, so a longer sentence it heard nothing of wasn't said in full.
 */
function isOneWord(input: HearInput): boolean {
  return noSpeech(input).match.words.length <= 1;
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

/**
 * The providers back each other up, including for languages the transcriber refuses. A thorough
 * check, like a surname's, lets the judge grade even a transcript that settles the answer.
 */
export async function hearSpokenSentence({
  check = "fast",
  ...input
}: HearInput & { check?: SentenceCheck }): Promise<HeardSentence> {
  // A transcript can spell a surname correctly even when the speaker used its ordinary reading.
  const [verifyExactReading, transcript, noSpeechCheck] = await Promise.all([
    needsSurnameCheck(input),
    transcribe(input),
    transcribe(input, NO_SPEECH_CHECK_MODEL),
  ]);

  if (!transcript) {
    if (!spoke(noSpeechCheck) || (transcript === "" && !isOneWord(input))) {
      return noSpeech(input);
    }

    return assessWordByWord(input);
  }

  const { heard, listen } = await compareTranscript({ ...input, transcript, verifyExactReading });

  if (!listen && check === "fast" && !verifyExactReading) {
    return heard;
  }

  if (heard.match.score === 0 && !spoke(noSpeechCheck)) {
    return noSpeech(input);
  }

  const judged = await safeAsync(() =>
    assessWordByWord({ ...input, transcriberHeard: transcript }),
  );

  if (!judged.error) {
    return judged.data;
  }

  if (listen) {
    throw judged.error;
  }

  logError("The thorough speech check failed; grading the transcript", judged.error);
  return heard;
}
