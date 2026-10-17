import "server-only";
import { randomUUID } from "node:crypto";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import {
  type TTSVoice,
  getBaseLanguage,
  getMaiVoiceLocale,
  isOpenAITTSSupportedLanguage,
  usesNonLatinScript,
} from "@zoonk/utils/languages";
import { logError } from "@zoonk/utils/logger";
import { segmentWords } from "@zoonk/utils/string";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { captureAiGeneration } from "../../provenance/ai-generation-sink";
import { type TaskProvenance } from "../../provenance/task-provenance";
import { checkWordPronunciation } from "../v2/language/check-word-pronunciation";
import { type WordIpa, writeWordIpa } from "../v2/language/word-ipa";
import { convertWavToMp3 } from "./convert-wav-to-mp3";
import alphabetSymbolPrompt from "./generate-language-audio-alphabet-symbol.prompt.md";
import { DEFAULT_LANGUAGE_AUDIO_VOICE, getLanguageAudioPrompt } from "./language-audio-prompt";
import { assertExpectedAudioSize, getMaxSeconds } from "./speech-limits";
import { type SpeechModelName, speechModels } from "./speech-models";
import { buildSpeechProvenance } from "./speech-provenance";
import { generateSpeechWithProvider } from "./speech-provider";

const TASK = "language-audio";
const MS_PER_SECOND = 1000;

/** A look-alike word's check usually takes about 3s; one took 43s in its eval (11 Oct 2026). */
const PRONUNCIATION_CHECK_TIMEOUT_MS = 15_000;
const PRONUNCIATION_LISTENS = 2;

/**
 * The text-to-speech run that voiced a clip, stored with the audio like every generated row's
 * provenance. `promptVersion` covers the voice and the instructions it was read with.
 */
export type SpeechProvenance = Pick<
  TaskProvenance,
  "generatedAt" | "model" | "promptVersion" | "runId"
>;

type VoicedAudio = {
  audio: Uint8Array;
  durationSeconds: number;
  format: "mp3";
  model: SpeechModelName;
  providerMetadata: Record<string, unknown>;
};

export type AudioResult = {
  audio: Uint8Array;
  /** How long the clip plays. */
  durationMs: number;
  format: "mp3";
  provenance: TaskProvenance;
};

export type LanguageAudioUsage = "alphabetSymbol";

const usagePrompts = { alphabetSymbol: alphabetSymbolPrompt } satisfies Record<
  LanguageAudioUsage,
  string
>;

/** A word alone that English spells the same: how it sounds in its language and in English. */
type LookAlike = { [Key in keyof WordIpa]: NonNullable<WordIpa[Key]> };

/**
 * The automatic order (see `speechModels`): Gemini Flash, then Gemini Flash Lite, then MAI-Voice
 * for the languages it speaks, then OpenAI's realtime voice for the languages OpenAI speaks when
 * the text is longer than one word. Each model is tried once: the next one is the retry. An
 * explicit model, from the audio test tool, gets a second attempt instead, because transport
 * retries can't see silent or malformed audio.
 *
 * A word English spells the same only goes to Gemini Flash, up to three times. Without help,
 * Flash read 19 of 24 of them with the language's sounds (8 such words, 3 tries each); with the
 * word's IPA and two listens, 27 of 27 (11 Oct 2026). Flash Lite follows the IPA less (16 of 24),
 * and its half-English readings sometimes passed a listen. MAI-Voice can't take the IPA, and read
 * "Name" in German and "pain" in French the English way. A word read the English way is worse
 * than one voiced later.
 */
function getSpeechModels({
  lookAlike,
  language,
  model,
  text,
}: {
  lookAlike: LookAlike | null;
  language: string;
  model?: SpeechModelName;
  text: string;
}): readonly SpeechModelName[] {
  if (model) {
    return [model, model];
  }

  if (lookAlike) {
    return [speechModels.geminiFlash, speechModels.geminiFlash, speechModels.geminiFlash];
  }

  const baseLanguage = getBaseLanguage(language);
  const speaksMaiVoice = getMaiVoiceLocale(baseLanguage) !== null;
  const speaksOpenAI = isOpenAITTSSupportedLanguage(baseLanguage) && segmentWords(text).length > 1;

  return [
    speechModels.geminiFlash,
    speechModels.geminiFlashLite,
    ...(speaksMaiVoice ? [speechModels.maiVoiceFlash] : []),
    ...(speaksOpenAI ? [speechModels.openaiRealtimeMini] : []),
  ];
}

/**
 * A word alone that English spells the same ("Name" in German, "time" in Brazilian Portuguese),
 * which voices otherwise read the English way, with both readings in IPA; null for any other text,
 * or when the IPA couldn't be written, so the clip is still voiced. Only a Latin-script language
 * other than English can share a spelling with English, and only a word alone gets read that way:
 * in a sentence the other words give the language away.
 */
async function findLookAlike({
  analytics,
  language,
  text,
  usage,
}: {
  analytics?: AiGenerationContext;
  language: string;
  text: string;
  usage?: LanguageAudioUsage;
}): Promise<LookAlike | null> {
  const canLookEnglish =
    !usage &&
    getBaseLanguage(language) !== "en" &&
    !usesNonLatinScript(language) &&
    segmentWords(text).length === 1;

  if (!canLookEnglish) {
    return null;
  }

  const { data, error } = await safeAsync(() => writeWordIpa({ analytics, language, word: text }));

  if (error) {
    logError("Writing a word's IPA failed; voicing it without:", error);
    return null;
  }

  const { englishIpa, ipa } = data.data;
  return englishIpa && ipa ? { englishIpa, ipa } : null;
}

/**
 * Listens to a look-alike word's clip twice, at once, and fails it unless neither listen heard
 * English, so the next model voices it again. One listen let a half-English "time" (ˈtaɪmi, in
 * Brazilian Portuguese) through that another caught, in 2 of 7 tries of that word (11 Oct 2026).
 * A listen that can't run, or doesn't answer in time, doesn't count: with no answer at all the
 * clip is kept, since the IPA already steers it and a lesson without the word's audio is worse.
 */
async function assertNativeReading({
  analytics,
  audio,
  language,
  lookAlike,
  model,
  text,
}: {
  analytics?: AiGenerationContext;
  audio: Uint8Array;
  language: string;
  lookAlike: LookAlike;
  model: SpeechModelName;
  text: string;
}) {
  const listen = () =>
    safeAsync(() =>
      checkWordPronunciation({
        abortSignal: AbortSignal.timeout(PRONUNCIATION_CHECK_TIMEOUT_MS),
        analytics,
        audio,
        englishIpa: lookAlike.englishIpa,
        ipa: lookAlike.ipa,
        language,
        mediaType: "audio/mpeg",
        word: text,
      }),
    );

  const listens = await Promise.all(Array.from({ length: PRONUNCIATION_LISTENS }, listen));
  const checks = listens.flatMap(({ data }) => (data ? [data.data] : []));

  for (const { error } of listens) {
    if (error) {
      logError("Checking a word's pronunciation failed:", error);
    }
  }

  const heardElse = checks.find((check) => !check.soundsNative);

  if (heardElse) {
    throw new Error(
      `${model} didn't read "${text}" with its language's sounds (heard /${heardElse.heard}/)`,
    );
  }
}

type VoiceInput = {
  analytics?: AiGenerationContext;
  instructions: string;
  language: string;
  lookAlike: LookAlike | null;
  text: string;
  voice: TTSVoice;
};

/**
 * Generates WAV and converts it to the one upload format inside the retry boundary, then checks a
 * look-alike word's sounds. Malformed, silent or overlong audio, or a word read the English way,
 * therefore follows the same fallback path as transport and API failures, whichever provider
 * produced it.
 */
async function generateWithModel({
  analytics,
  instructions,
  language,
  lookAlike,
  model,
  text,
  voice,
}: VoiceInput & { model: SpeechModelName }): Promise<VoicedAudio> {
  const maxSeconds = getMaxSeconds(text);

  const { audio: wavAudio, providerMetadata } = await generateSpeechWithProvider({
    instructions,
    language,
    model,
    text,
    voice,
  });

  assertExpectedAudioSize({ audio: wavAudio, maxSeconds, model });

  const { audio, durationSeconds } = await convertWavToMp3({ audio: wavAudio, maxSeconds, model });

  if (lookAlike) {
    await assertNativeReading({ analytics, audio, language, lookAlike, model, text });
  }

  return { audio, durationSeconds, format: "mp3", model, providerMetadata };
}

/**
 * Tries provider-qualified models in order. Each adapter owns transient request retries; this
 * layer owns cross-model and post-decode quality retries.
 */
async function generateWithFallback({
  models,
  ...input
}: VoiceInput & { models: readonly SpeechModelName[] }): Promise<VoicedAudio> {
  const [model, ...remainingModels] = models;

  if (!model) {
    throw new Error("No speech model configured");
  }

  try {
    return await generateWithModel({ ...input, model });
  } catch (error) {
    if (remainingModels.length > 0) {
      return generateWithFallback({ ...input, models: remainingModels });
    }

    const lastError = error instanceof Error ? error : new Error(String(error));
    logError("All TTS providers failed after retries:", lastError);
    throw lastError;
  }
}

/**
 * Voices a word, sentence or passage in its language, Gemini first (see `speechModels`). Every
 * request names the language in its instructions, English included, and a word English spells
 * the same also gets its IPA and a listen afterwards (`findLookAlike`, `assertNativeReading`). An
 * explicit model bypasses the automatic order.
 * The result names the model that actually voiced it, after any fallback, and how long the clip
 * plays.
 */
export async function generateLanguageAudio({
  analytics,
  language,
  model,
  text,
  usage,
  voice = DEFAULT_LANGUAGE_AUDIO_VOICE,
}: {
  analytics?: AiGenerationContext;
  language: string;
  model?: SpeechModelName;
  text: string;
  usage?: LanguageAudioUsage;
  voice?: TTSVoice;
}): Promise<SafeReturn<AudioResult>> {
  const lookAlike = await findLookAlike({ analytics, language, text, usage });

  const { instructions, promptVersion } = getLanguageAudioPrompt({
    ...(lookAlike ? { ipa: lookAlike.ipa } : {}),
    language,
    usagePrompt: usage ? usagePrompts[usage] : "",
    voice,
  });

  const models = getSpeechModels({ language, lookAlike, ...(model ? { model } : {}), text });
  const [requestedModel = speechModels.geminiFlash] = models;
  const runId = randomUUID();
  const startedAt = performance.now();

  return safeAsync(async () => {
    const voiced = await generateWithFallback({
      analytics,
      instructions,
      language,
      lookAlike,
      models,
      text,
      voice,
    });

    const provenance = buildSpeechProvenance({
      instructions,
      latencyMs: Math.round(performance.now() - startedAt),
      promptVersion,
      requestedModel,
      runId,
      text,
      voiced,
    });

    await captureAiGeneration({ context: analytics, provenance, task: TASK });

    return {
      audio: voiced.audio,
      durationMs: Math.round(voiced.durationSeconds * MS_PER_SECOND),
      format: voiced.format,
      provenance,
    };
  });
}
