import { readEvalAudio } from "@/lib/audio-files";
import { createFixedScore } from "@/lib/score";
import { type TaskScorer, type TokenUsage, toTokenUsage } from "@/lib/types";
import { assessPronunciation } from "@zoonk/ai/tasks/language/assess-pronunciation";
import {
  type WordPronunciationCheck,
  checkWordPronunciation,
} from "@zoonk/ai/tasks/language/check-word-pronunciation";
import { transcribeSpeech } from "@zoonk/ai/tasks/language/transcribe-speech";
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
    transcribeSpeech({ audio, language: input.language, model: "openai/gpt-transcribe" }),
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

  const flags = [misheard, unclear, lookAlike?.verdict.soundsNative === false ? [input.text] : []];
  const votes = new Map<string, number>();

  for (const words of flags) {
    const normalized = new Set(
      words.map((word) => word.normalize("NFC").toLocaleLowerCase(input.language)),
    );

    normalized.forEach((word) => votes.set(word, (votes.get(word) ?? 0) + 1));
  }

  const confirmed = [...votes].filter(([, count]) => count >= 2).map(([word]) => word);
  const unconfirmed = [...votes].filter(([, count]) => count === 1).map(([word]) => word);
  const total = match.words.length;
  const readRight = confirmed.length === 0;

  const heardRight =
    total === 0 ? Number(readRight) : (total - Math.min(confirmed.length, total)) / total;

  const score = Math.max(MIN_SCORE, Math.round(MAX_SCORE * heardRight * 10) / 10);
  const pendingStatus = unconfirmed.length > 0 ? "Needs a listen" : "Read right";
  const status = readRight ? pendingStatus : "Confirmed misread";

  const listening = `${status}: eval-results/audio/${audioPath}.${
    unconfirmed.length > 0 ? ` Single-check flags: ${unconfirmed.join(", ")}.` : ""
  }`;

  const lookAlikeConclusion = lookAlike
    ? ` As a look-alike it sounded ${lookAlike.verdict.soundsNative ? "native" : "english"} (called ${lookAlike.verdict.pronunciation}, /${lookAlike.verdict.heard}/).`
    : "";

  const conclusion = `${listening} Read "${input.text}". gpt-transcribe heard "${transcript.data.text}" (misheard ${JSON.stringify(misheard)}); the pronunciation check heard "${pronunciation.data.transcript}" (unclear ${JSON.stringify(unclear)}).${lookAlikeConclusion}`;

  return {
    ...createFixedScore({ conclusion, score }),
    classification: { expected: "read right", predicted: readRight ? "read right" : "misread" },
    judge: {
      modelId: PRONUNCIATION_MODEL,
      usage: addUsage(toTokenUsage(pronunciation.usage), lookAlike?.usage),
    },
  };
};
