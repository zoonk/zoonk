import { createGoogle } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { type TTSVoice } from "@zoonk/utils/languages";
import { type SpeechModel, generateSpeech } from "ai";
import { type SpeechModelName, speechModels } from "./speech-models";

type SpeechProvider = { model: SpeechModel; voice: string };

const google = createGoogle({ apiKey: process.env.GEMINI_API_KEY });
const GEMINI_DEFAULT_INSTRUCTIONS = "Read the supplied transcript aloud. Return audio only.";

/**
 * Removes the provider prefix after the typed registry has established which
 * provider owns the model. Provider SDKs expect bare identifiers while task
 * callers use provider-qualified names consistently across the AI package.
 */
function getSpeechModelId(model: SpeechModelName): string {
  const separatorIndex = model.indexOf("/");
  return model.slice(separatorIndex + 1);
}

/**
 * Adds minimal read-aloud guidance only when Gemini has no richer task prompt.
 * Gemini otherwise treats some short transcripts, such as `Hello`, as a text
 * request and rejects them before producing audio. OpenAI does not need this.
 */
function getSpeechInstructions({
  instructions,
  model,
}: {
  instructions?: string;
  model: SpeechModelName;
}): string | undefined {
  if (instructions) {
    return instructions;
  }

  if (model === speechModels.google) {
    return GEMINI_DEFAULT_INSTRUCTIONS;
  }

  return undefined;
}

/**
 * Resolves a provider-qualified name into the corresponding AI SDK model and
 * voice. Both providers return WAV so the task can apply one validation and
 * encoding pipeline without codec-specific branches.
 */
function getSpeechProvider({
  model,
  voice,
}: {
  model: SpeechModelName;
  voice: TTSVoice;
}): SpeechProvider {
  const modelId = getSpeechModelId(model);

  if (model === speechModels.google) {
    return { model: google.speech(modelId), voice };
  }

  if (model === speechModels.openai) {
    return { model: openai.speech(modelId), voice: "marin" };
  }

  throw new Error("Unsupported speech model");
}

/**
 * Generates WAV through either AI SDK provider. WAV adds only a small header to
 * the PCM samples while keeping the intermediate self-describing and avoiding
 * provider-specific parsing in the task layer.
 */
export async function generateSpeechWithProvider({
  instructions,
  model,
  text,
  voice,
}: {
  instructions?: string;
  model: SpeechModelName;
  text: string;
  voice: TTSVoice;
}): Promise<Uint8Array> {
  const provider = getSpeechProvider({ model, voice });
  const speechInstructions = getSpeechInstructions({ instructions, model });

  const { audio } = await generateSpeech({
    ...(speechInstructions ? { instructions: speechInstructions } : {}),
    model: provider.model,
    outputFormat: "wav",
    text,
    voice: provider.voice,
  });

  return audio.uint8Array;
}
