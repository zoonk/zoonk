import { saveEvalAudio } from "@/lib/audio-files";
import { type Task } from "@/lib/types";
import { isSpeechModelName } from "@zoonk/ai/speech-models";
import { generateLanguageAudio } from "@zoonk/ai/tasks/audio";
import { type LanguageAudioOutput, scoreLanguageAudio } from "./scorer";
import { type LanguageAudioInput, TEST_CASES } from "./test-cases";

const TASK_ID = "language-audio";

/**
 * Voices the text through the app's own speech task with one model (a second try on failure, as
 * the audio test page does), so the clip passes the same size, silence and encoding checks a
 * lesson's would, and saves the MP3 to listen to.
 */
async function voiceText({
  caseId,
  language,
  model,
  text,
}: LanguageAudioInput & { model: string }) {
  if (!isSpeechModelName(model)) {
    throw new Error(`${model} is not a speech model.`);
  }

  const { data, error } = await generateLanguageAudio({ language, model, text });

  if (error) {
    throw error;
  }

  const audioPath = await saveEvalAudio({
    audio: data.audio,
    modelId: model,
    name: caseId,
    taskId: TASK_ID,
  });

  const output: LanguageAudioOutput = {
    audioPath,
    costUsd: data.provenance.costUsd ?? null,
    durationMs: data.durationMs,
  };

  return {
    data: output,
    systemPrompt: "",
    usage: { inputTokens: 0, outputTokens: 0 },
    userPrompt: text,
  };
}

export const languageAudioTask: Task<LanguageAudioInput, LanguageAudioOutput> = {
  description:
    "Read a word, sentence or short passage aloud in its language so that two listeners from different providers hear every word as written (the clips lessons play)",
  generate: voiceText,
  id: TASK_ID,
  name: "Language Audio",
  output: "speech",
  score: scoreLanguageAudio,
  testCases: TEST_CASES,
};
