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
 * Flash Lite first, Flash when a line fails. On the same two-speaker booking call (10 Oct 2026),
 * both were equally intelligible (gpt-transcribe heard every word of both; only number formats
 * differed) and a Gemini 3.8 Flash judge rated Flash Lite's naturalness 4.5 of 5 against Flash's 5,
 * at $0.0095 a minute against $0.014. Neither follows an accent instruction reliably (a blind judge
 * heard the asked accent in 2 of 4 lines on each), so accents are asked for but not promised. Both
 * have the same voices, so a line Flash Lite fails keeps its speaker's voice on Flash. OpenAI isn't
 * a fallback: its voices differ, and a recording whose speaker changes voice halfway is worse than
 * one voiced again later.
 */
const LISTENING_SPEECH_MODELS: readonly SpeechModelName[] = [
  speechModels.geminiFlashLite,
  speechModels.geminiFlash,
];

/** One turn of a script as it's voiced: the speaker's voice and accent and what they say. */
export type ListeningLine = { accent: string; text: string; voice: TTSVoice };

type VoicedPart = { audio: EncodableAudio; provenance: TaskProvenance };

type PartInput = {
  analytics?: AiGenerationContext;
  instructions: string;
  language: string;
  /** The first model of the order, which provenance names as the one asked for. */
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

/**
 * Voices a listening exam's recording: each turn in its speaker's voice and accent, long turns in
 * a few parts so every call stays short, all at once, then joined in order with a pause between
 * turns and encoded as one MP3. A part that fails on every model fails the recording, which is
 * voiced again later rather than played with a gap. Each call sends its own event; the result
 * carries one provenance for the stored recording, with every call's audio and cost.
 */
export async function voiceListeningScript({
  analytics,
  language,
  lines,
  model,
  serviceTier,
}: {
  analytics?: AiGenerationContext;
  /** The recording's language, such as "en". */
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
