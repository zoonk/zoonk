import { readEvalAudio } from "@/lib/audio-files";
import { createFixedScore } from "@/lib/score";
import { type TaskScorer, type TokenUsage, toTokenUsage } from "@/lib/types";
import { assessPronunciation } from "@zoonk/ai/tasks/v2/language/assess-pronunciation";
import {
  type WordPronunciationCheck,
  checkWordPronunciation,
} from "@zoonk/ai/tasks/v2/language/check-word-pronunciation";
import { transcribeSpeech } from "@zoonk/ai/tasks/v2/language/transcribe-speech";
import { matchSpokenAnswer } from "@zoonk/core/library/language/spoken-answer-match";
import { type LanguageAudioInput, type LookAlike } from "./test-cases";

export type LanguageAudioOutput = { audioPath: string; costUsd: number | null; durationMs: number };

const PRONUNCIATION_MODEL = "google/gemini-3.8-flash";
const MAX_SCORE = 10;
const MIN_SCORE = 1;

async function judgeLookAlike({
  audio,
  language,
  lookAlike,
  text,
}: {
  audio: Uint8Array;
  language: string;
  lookAlike: LookAlike;
  text: string;
}): Promise<{ usage: TokenUsage; verdict: WordPronunciationCheck }> {
  const { data, usage } = await checkWordPronunciation({
    audio,
    englishIpa: lookAlike.english,
    ipa: lookAlike.native,
    language,
    mediaType: "audio/mpeg",
    model: PRONUNCIATION_MODEL,
    word: text,
  });

  return { usage: toTokenUsage(usage), verdict: data };
}

function addUsage(left: TokenUsage, right?: TokenUsage): TokenUsage {
  if (!right) {
    return left;
  }

  return {
    inputTokens: left.inputTokens + right.inputTokens,
    outputTokens: left.outputTokens + right.outputTokens,
  };
}

export const scoreLanguageAudio: TaskScorer = async ({ output, testCase }) => {
  const input = testCase.userInput as LanguageAudioInput;
  const { audioPath } = JSON.parse(output) as LanguageAudioOutput;
  const audio = await readEvalAudio(audioPath);

  const [transcript, pronunciation, lookAlike] = await Promise.all([
    transcribeSpeech({
      audio,
      language: input.language,
      model: "openai/gpt-transcribe",
      useFallback: false,
    }),
    assessPronunciation({
      audio,
      expectedText: input.text,
      language: input.language,
      mediaType: "audio/mpeg",
      model: PRONUNCIATION_MODEL,
    }),
    input.lookAlike
      ? judgeLookAlike({
          audio,
          language: input.language,
          lookAlike: input.lookAlike,
          text: input.text,
        })
      : undefined,
  ]);

  const match = matchSpokenAnswer({
    expected: input.text,
    heard: transcript.data.text,
    language: input.language,
  });

  const misheard = match.words.filter((word) => word.status !== "correct").map((word) => word.text);

  const unclear = pronunciation.data.words
    .filter((word) => word.status !== "correct")
    .map((word) => word.text);

  const flagged = new Set([...misheard, ...unclear]);
  const total = match.words.length;
  const heardRight = total === 0 ? 0 : (total - Math.min(flagged.size, total)) / total;
  const soundsNative = !lookAlike || lookAlike.verdict.soundsNative;
  const wordsScore = Math.max(MIN_SCORE, Math.round(MAX_SCORE * heardRight * 10) / 10);
  const score = soundsNative ? wordsScore : MIN_SCORE;
  const readRight = flagged.size === 0 && total > 0 && soundsNative;

  const lookAlikeConclusion = lookAlike
    ? ` As a look-alike it sounded ${lookAlike.verdict.soundsNative ? "native" : "english"} (called ${lookAlike.verdict.pronunciation}, /${lookAlike.verdict.heard}/).`
    : "";

  const conclusion = `Read "${input.text}". gpt-transcribe heard "${transcript.data.text}" (misheard ${JSON.stringify(misheard)}); the pronunciation check heard "${pronunciation.data.transcript}" (unclear ${JSON.stringify(unclear)}).${lookAlikeConclusion}`;

  return {
    ...createFixedScore({ conclusion, score }),
    classification: { expected: "read right", predicted: readRight ? "read right" : "misread" },
    judge: {
      modelId: PRONUNCIATION_MODEL,
      usage: addUsage(toTokenUsage(pronunciation.usage), lookAlike?.usage),
    },
  };
};
