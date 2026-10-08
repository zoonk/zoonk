import { readFile } from "node:fs/promises";
import path from "node:path";
import { type Task } from "@/lib/types";
import {
  type SpeechTranscript,
  TRANSCRIPTION_MODELS,
  type TranscriptionModelId,
  transcribeSpeech,
} from "@zoonk/ai/tasks/v2/language/transcribe-speech";
import { scoreSpeechTranscript } from "./scorer";
import { type SpeechClipExpected, type SpeechClipInput, TEST_CASES } from "./test-cases";

/** Clips made by scripts/generate-speech-clips.ts, one per test case id. */
export const SPEECH_CLIPS_DIR = path.join(process.cwd(), "data", "speech");

type SpeechClipRun = SpeechClipInput & { id?: string; model: string };

function toTranscriptionModel(model: string): TranscriptionModelId {
  const found = TRANSCRIPTION_MODELS.find((candidate) => candidate === model);

  if (!found) {
    throw new Error(`${model} is not a transcription model.`);
  }

  return found;
}

type SpeechClipCase = { id: string; userInput: { spokenText: string } };

/**
 * Test inputs don't carry their id, so each clip is found by its spoken text,
 * which is unique across the cases.
 */
export function findSpeechClipPath({
  spokenText,
  testCases,
}: {
  spokenText: string;
  testCases: readonly SpeechClipCase[];
}): string {
  const testCase = testCases.find((item) => item.userInput.spokenText === spokenText);

  if (!testCase) {
    throw new Error(`No clip for "${spokenText}".`);
  }

  return path.join(SPEECH_CLIPS_DIR, `${testCase.id}.mp3`);
}

async function transcribeClip(input: SpeechClipRun) {
  const audio = new Uint8Array(
    await readFile(findSpeechClipPath({ spokenText: input.spokenText, testCases: TEST_CASES })),
  );

  const { data } = await transcribeSpeech({
    audio,
    language: input.language,
    model: toTranscriptionModel(input.model),
    useFallback: false,
  });

  return {
    data,
    systemPrompt: "",
    usage: { inputTokens: 0, outputTokens: 0 },
    userPrompt: `Clip of "${input.spokenText}" (expected "${input.targetText}")`,
  };
}

export const transcribeSpeechTask: Task<SpeechClipInput, SpeechTranscript, SpeechClipExpected> = {
  description:
    "Transcribe a learner's spoken answer as said, mistakes included, so word-by-word grading can flag them (labeled text-to-speech clips)",
  generate: transcribeClip,
  id: "transcribe-speech",
  name: "Transcribe Speech",
  output: "transcription",
  score: scoreSpeechTranscript,
  testCases: TEST_CASES,
};
