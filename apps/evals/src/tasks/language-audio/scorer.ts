import { readEvalAudio } from "@/lib/audio-files";
import { createFixedScore } from "@/lib/score";
import { type TaskScorer, type TokenUsage, toTokenUsage } from "@/lib/types";
import { saysMoreThanText } from "@zoonk/ai/tasks/audio/speech-after-text";
import { assessPronunciation } from "@zoonk/ai/tasks/language/assess-pronunciation";
import {
  type WordPronunciationCheck,
  checkWordPronunciation,
} from "@zoonk/ai/tasks/language/check-word-pronunciation";
import { transcribeSpeech } from "@zoonk/ai/tasks/language/transcribe-speech";
import { matchSpokenAnswer } from "@zoonk/core/library/language/spoken-answer-match";
import { listeningVerdict } from "./listening-verdict";
import { type LanguageAudioInput, type LookAlike } from "./test-cases";

export type LanguageAudioOutput = { audioPath: string; costUsd: number | null; durationMs: number };

const PRONUNCIATION_MODEL = "google/gemini-3.8-flash";
const TRANSCRIPTION_MODEL = "openai/gpt-transcribe";

/** Counted like a misread word, so two providers hearing a clip go on past its text confirm it. */
const ADDED_WORDS = "(words after the text)";

function addedWords({ heard, input }: { heard: string; input: LanguageAudioInput }): string[] {
  return saysMoreThanText({ heard, language: input.language, text: input.text })
    ? [ADDED_WORDS]
    : [];
}

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
    transcribeSpeech({ audio, language: input.language, model: TRANSCRIPTION_MODEL }),
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

  const misheard = [
    ...match.words.filter((word) => word.status !== "correct").map((word) => word.text),
    ...addedWords({ heard: transcript.data.text, input }),
  ];

  const unclear = [
    ...pronunciation.data.words
      .filter((word) => word.status !== "correct")
      .map((word) => word.text),
    ...addedWords({ heard: pronunciation.data.transcript, input }),
  ];

  const { readRight, score, status, unconfirmed } = listeningVerdict({
    flags: [
      { model: TRANSCRIPTION_MODEL, words: misheard },
      { model: PRONUNCIATION_MODEL, words: unclear },
      {
        model: PRONUNCIATION_MODEL,
        words: lookAlike?.verdict.soundsNative === false ? [input.text] : [],
      },
    ],
    language: input.language,
    wordCount: match.words.length,
  });

  const listening = `${status}: eval-results/audio/${audioPath}.${
    unconfirmed.length > 0 ? ` Single-provider flags: ${unconfirmed.join(", ")}.` : ""
  }`;

  const lookAlikeConclusion = lookAlike
    ? ` As a look-alike it sounded ${lookAlike.verdict.soundsNative ? "native" : "english"} (called ${lookAlike.verdict.pronunciation}, /${lookAlike.verdict.heard}/).`
    : "";

  const conclusion = `${listening} Read "${input.text}". gpt-transcribe heard "${transcript.data.text}" (misheard ${JSON.stringify(misheard)}); the pronunciation check heard "${pronunciation.data.transcript}" (unclear ${JSON.stringify(unclear)}).${lookAlikeConclusion}`;

  const judge = {
    modelId: PRONUNCIATION_MODEL,
    usage: addUsage(toTokenUsage(pronunciation.usage), lookAlike?.usage),
  };

  if (score === null) {
    return { judge, listeningReview: { audioPath, conclusion }, score, steps: [] };
  }

  return {
    ...createFixedScore({ conclusion, score }),
    classification: { expected: "read right", predicted: readRight ? "read right" : "misread" },
    judge,
  };
};
