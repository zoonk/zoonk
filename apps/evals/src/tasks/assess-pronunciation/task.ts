import { readFile } from "node:fs/promises";
import { type Task } from "@/lib/types";
import { type Reasoning } from "@zoonk/ai/provider-options";
import {
  type AssessPronunciationSchema,
  assessPronunciation,
} from "@zoonk/ai/tasks/v2/language/assess-pronunciation";
import {
  TRANSCRIPTION_MODELS,
  type TranscriptionModelId,
  transcribeSpeech,
} from "@zoonk/ai/tasks/v2/language/transcribe-speech";
import { matchSpokenAnswer } from "@zoonk/core/library/language/spoken-answer-match";
import { findSpeechClipPath } from "../transcribe-speech/task";
import { scorePronunciation } from "./scorer";
import {
  type PronunciationClipExpected,
  type PronunciationClipInput,
  TEST_CASES,
} from "./test-cases";

type PronunciationClipRun = PronunciationClipInput & {
  model: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
};

function toTranscriptionModel(model: string): TranscriptionModelId | undefined {
  return TRANSCRIPTION_MODELS.find((candidate) => candidate === model);
}

/**
 * Today's path, as the baseline: transcribe the clip, then compare the
 * transcript with the expected sentence word by word. It can't name a sound
 * or stress issue, so every issue stays null.
 */
async function transcribeAndMatch({
  audio,
  input,
  model,
}: {
  audio: Uint8Array;
  input: PronunciationClipInput;
  model: TranscriptionModelId;
}) {
  const { data } = await transcribeSpeech({
    audio,
    language: input.language,
    model,
    useFallback: false,
  });

  const match = matchSpokenAnswer({
    expected: input.targetText,
    heard: data.text,
    language: input.language,
  });

  const result: AssessPronunciationSchema = {
    transcript: data.text,
    words: match.words.map((word) => ({ ...word, issue: null })),
  };

  return {
    data: result,
    systemPrompt: "",
    usage: { inputTokens: 0, outputTokens: 0 },
    userPrompt: `Clip of "${input.spokenText}" (expected "${input.targetText}")`,
  };
}

async function assessClip(run: PronunciationClipRun) {
  const { model, reasoning, useFallback, ...input } = run;
  const clipPath = findSpeechClipPath({ spokenText: input.spokenText, testCases: TEST_CASES });
  const audio = new Uint8Array(await readFile(clipPath));
  const transcriptionModel = toTranscriptionModel(model);

  if (transcriptionModel) {
    return transcribeAndMatch({ audio, input, model: transcriptionModel });
  }

  return assessPronunciation({
    audio,
    expectedText: input.targetText,
    language: input.language,
    learnerLanguage: input.learnerLanguage,
    mediaType: "audio/mpeg",
    model,
    reasoning,
    useFallback,
  });
}

export const assessPronunciationTask: Task<
  PronunciationClipInput,
  AssessPronunciationSchema,
  PronunciationClipExpected
> = {
  description:
    "Judge from the audio whether a listener would understand each word of a spoken sentence (correct, different or missed, with sound or stress issues), never flagging an accent, against labeled text-to-speech clips. Run a transcription model from the CLI for the transcript-and-compare baseline",
  generate: assessClip,
  id: "assess-pronunciation",
  name: "Assess Pronunciation",
  score: scorePronunciation,
  testCases: TEST_CASES,
};
