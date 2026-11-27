import "server-only";
import { randomUUID } from "node:crypto";
import { MS_PER_SECOND } from "@zoonk/utils/date";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { type TTSVoice, getBaseLanguage } from "@zoonk/utils/languages";
import { logError } from "@zoonk/utils/logger";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { captureAiGeneration } from "../../provenance/ai-generation-sink";
import { combineTaskProvenance } from "../../provenance/combine-task-provenance";
import { type TaskProvenance } from "../../provenance/task-provenance";
import { type ServiceTier } from "../../provider-options";
import { decodeSpeechWav, encodeMp3 } from "./convert-wav-to-mp3";
import { type AudioResult } from "./generate-language-audio";
import { joinSpeech, splitSpokenText } from "./listening-audio-parts";
import {
  getListeningVoiceInstructions,
  getListeningVoicePromptVersion,
} from "./listening-voice-prompt";
import { assertExpectedAudioSize, getMaxSeconds } from "./speech-limits";
import { type SpeechModelName, getSpeakingModels, speechModels } from "./speech-models";
import { buildSpeechProvenance } from "./speech-provenance";
import { generateSpeechWithProvider } from "./speech-provider";

const TASK = "listening-audio";

/**
 * Flash Lite was as intelligible as Flash and nearly as natural at two thirds the price (10 Oct
 * 2026). Both share voices, so a failed line keeps its speaker's voice; OpenAI's voices differ.
 */
const LISTENING_SPEECH_MODELS: readonly SpeechModelName[] = [
  speechModels.geminiFlashLite,
  speechModels.geminiFlash,
];

type ListeningLine = { accent: string; text: string; voice: TTSVoice };

export type ListeningPart = ListeningLine & { turn: number };

export { getListeningVoicePromptVersion } from "./listening-voice-prompt";

type ListeningScript = { language: string; lines: readonly ListeningLine[] };

export function splitListeningParts({ language, lines }: ListeningScript): ListeningPart[] {
  const locale = getBaseLanguage(language);

  return lines.flatMap((line, turn) =>
    splitSpokenText({ locale, text: line.text }).map((text) => ({ ...line, text, turn })),
  );
}

type PartInput = {
  analytics?: AiGenerationContext;
  attempt: number;
  language: string;
  part: ListeningPart;
  serviceTier?: ServiceTier;
};

function listeningModels(language: string) {
  return getSpeakingModels({ candidates: LISTENING_SPEECH_MODELS, language });
}

type RecordedPart = { audio: Uint8Array; text: string; model: string; turn: number };

function decodePart({ audio, model, text }: Omit<RecordedPart, "turn">) {
  const maxSeconds = getMaxSeconds(text);
  assertExpectedAudioSize({ audio, maxSeconds, model });
  return decodeSpeechWav({ audio, maxSeconds, model });
}

async function voicePartWithModels({
  analytics,
  attempt,
  language,
  models,
  part,
  serviceTier,
}: PartInput & { models: readonly SpeechModelName[] }) {
  const [requestedModel] = models;
  const model = models[(attempt - 1) % models.length];

  if (!model || !requestedModel) {
    throw new Error(`No listening speech model for ${language} on attempt ${attempt}`);
  }

  const { accent, text, voice } = part;
  const instructions = getListeningVoiceInstructions({ accent, language });
  const startedAt = performance.now();

  const { audio, providerMetadata } = await generateSpeechWithProvider({
    instructions,
    language,
    model,
    serviceTier,
    text,
    voice,
  });

  const decoded = decodePart({ audio, model, text });

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
  return { audio, model, provenance };
}

export function voiceListeningPart(
  input: PartInput,
): Promise<{ audio: Uint8Array; provenance: TaskProvenance }> {
  return voicePartWithModels({ ...input, models: listeningModels(input.language) });
}

export async function joinListeningParts(parts: readonly RecordedPart[]) {
  const joined = joinSpeech(parts.map((part) => ({ audio: decodePart(part), turn: part.turn })));
  const { audio, durationSeconds } = await encodeMp3(joined);
  return { audio, durationMs: Math.round(durationSeconds * MS_PER_SECOND), format: "mp3" as const };
}

/** @internal Whole-script entry point for voice evaluations. */
export async function voiceListeningScript({
  analytics,
  language,
  lines,
  model,
  serviceTier,
}: ListeningScript & {
  analytics?: AiGenerationContext;
  /** One model for every line, with a second try each, instead of the automatic order (evals). */
  model?: SpeechModelName;
  serviceTier?: ServiceTier;
}): Promise<SafeReturn<AudioResult>> {
  const models = model ? [model, model] : listeningModels(language);
  const parts = splitListeningParts({ language, lines });

  const result = await safeAsync(async () => {
    const voiced = await Promise.all(
      parts.map(async (part) => {
        const input = { analytics, language, models, part, serviceTier };

        const output = await voicePartWithModels({ ...input, attempt: 1 }).catch(() =>
          voicePartWithModels({ ...input, attempt: 2 }),
        );

        return { ...output, text: part.text, turn: part.turn };
      }),
    );

    return {
      ...(await joinListeningParts(voiced)),
      provenance: combineTaskProvenance(voiced.map((part) => part.provenance)),
    };
  });

  if (result.error) {
    logError("Voicing a listening recording failed:", result.error);
  }

  return result;
}
