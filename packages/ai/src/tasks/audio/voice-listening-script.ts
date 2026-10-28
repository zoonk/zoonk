import "server-only";
import { randomUUID } from "node:crypto";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { type TTSVoice, getBaseLanguage } from "@zoonk/utils/languages";
import { logError } from "@zoonk/utils/logger";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { captureAiGeneration } from "../../provenance/ai-generation-sink";
import { type TaskProvenance, combineTaskProvenance } from "../../provenance/task-provenance";
import { type ServiceTier } from "../../provider-options";
import { type EncodableAudio, decodeSpeechWav, encodeMp3 } from "./convert-wav-to-mp3";
import { type AudioResult } from "./generate-language-audio";
import { joinSpeech, splitSpokenText } from "./listening-audio-parts";
import {
  getListeningVoiceInstructions,
  getListeningVoicePromptVersion,
} from "./listening-voice-prompt";
import { assertExpectedAudioSize, getMaxSeconds } from "./speech-limits";
import { type SpeechModelName, speechModels } from "./speech-models";
import { buildSpeechProvenance } from "./speech-provenance";
import { generateSpeechWithProvider } from "./speech-provider";

const TASK = "listening-audio";
const MS_PER_SECOND = 1000;

/**
 * Flash Lite was as intelligible as Flash and nearly as natural at two thirds the price (10 Oct
 * 2026). Both share voices, so a failed line keeps its speaker's voice; OpenAI's voices differ.
 */
const LISTENING_SPEECH_MODELS: readonly SpeechModelName[] = [
  speechModels.geminiFlashLite,
  speechModels.geminiFlash,
];

export type ListeningLine = { accent: string; text: string; voice: TTSVoice };

type VoicedPart = { audio: EncodableAudio; provenance: TaskProvenance };

type PartInput = {
  analytics?: AiGenerationContext;
  instructions: string;
  language: string;
  requestedModel: SpeechModelName;
  serviceTier?: ServiceTier;
  text: string;
  voice: TTSVoice;
};

async function voicePartWithModel({
  analytics,
  requestedModel,
  ...input
}: PartInput & { model: SpeechModelName }) {
  const { instructions, model, text } = input;
  const maxSeconds = getMaxSeconds(text);
  const startedAt = performance.now();
  const { audio, providerMetadata } = await generateSpeechWithProvider(input);

  assertExpectedAudioSize({ audio, maxSeconds, model });
  const decoded = decodeSpeechWav({ audio, maxSeconds, model });

  const provenance = buildSpeechProvenance({
    instructions,
    latencyMs: Math.round(performance.now() - startedAt),
    promptVersion: getListeningVoicePromptVersion(),
    requestedModel,
    runId: randomUUID(),
    text,
    voiced: {
      durationSeconds: decoded.samplesDecoded / decoded.sampleRate,
      model,
      providerMetadata,
    },
  });

  await captureAiGeneration({ context: analytics, provenance, task: TASK });
  return { audio: decoded, provenance };
}

/** Tries each model once: malformed, silent or overlong audio moves on like a failed call. */
async function voicePart(
  input: PartInput,
  models: readonly SpeechModelName[] = LISTENING_SPEECH_MODELS,
): Promise<VoicedPart> {
  const [model, ...rest] = models;

  if (!model) {
    throw new Error("No speech model configured");
  }

  try {
    return await voicePartWithModel({ ...input, model });
  } catch (error) {
    if (rest.length > 0) {
      return voicePart(input, rest);
    }

    throw error;
  }
}

/** A part that fails on every model fails the recording: voiced again later, not with a gap. */
export async function voiceListeningScript({
  analytics,
  language,
  lines,
  model,
  serviceTier,
}: {
  analytics?: AiGenerationContext;
  language: string;
  lines: readonly ListeningLine[];
  /** One model for every line, with a second try each, instead of the automatic order (evals). */
  model?: SpeechModelName;
  serviceTier?: ServiceTier;
}): Promise<SafeReturn<AudioResult>> {
  const models = model ? [model, model] : LISTENING_SPEECH_MODELS;
  const locale = getBaseLanguage(language);

  const parts = lines.flatMap((line, turn) =>
    splitSpokenText({ locale, text: line.text }).map((text) => ({ line, text, turn })),
  );

  const result = await safeAsync(async () => {
    const voiced = await Promise.all(
      parts.map(({ line, text }) =>
        voicePart(
          {
            analytics,
            instructions: getListeningVoiceInstructions({ accent: line.accent, language }),
            language,
            requestedModel: models[0] ?? speechModels.geminiFlashLite,
            serviceTier,
            text,
            voice: line.voice,
          },
          models,
        ),
      ),
    );

    const joined = joinSpeech(
      voiced.map(({ audio }, index) => ({ audio, turn: parts[index]?.turn ?? index })),
    );

    const { audio, durationSeconds } = await encodeMp3(joined);

    return {
      audio,
      durationMs: Math.round(durationSeconds * MS_PER_SECOND),
      format: "mp3" as const,
      provenance: combineTaskProvenance(voiced.map((part) => part.provenance)),
    };
  });

  if (result.error) {
    logError("Voicing a listening recording failed:", result.error);
  }

  return result;
}
