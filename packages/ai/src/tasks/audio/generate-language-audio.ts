import "server-only";
import { isBlockedTestCall } from "@zoonk/utils/blocked-test-call";
import { MS_PER_SECOND } from "@zoonk/utils/date";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { type TTSVoice, getBaseLanguage, usesNonLatinScript } from "@zoonk/utils/languages";
import { logError } from "@zoonk/utils/logger";
import { segmentWords } from "@zoonk/utils/string";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { type TaskProvenance } from "../../provenance/task-provenance";
import { checkWordPronunciation } from "../language/check-word-pronunciation";
import { type WordIpa, writeWordIpa } from "../language/word-ipa";
import { convertWavToMp3 } from "./convert-wav-to-mp3";
import { type ClipAddition, findClipAddition } from "./find-clip-addition";
import alphabetSymbolPrompt from "./generate-language-audio-alphabet-symbol.prompt.md";
import { DEFAULT_LANGUAGE_AUDIO_VOICE, getLanguageAudioPrompt } from "./language-audio-prompt";
import { generateRecordedSpeech } from "./recorded-speech";
import { assertExpectedAudioSize, getMaxSeconds } from "./speech-limits";
import { type SpeechModelName, getSpeakingModels, speechModels } from "./speech-models";

const TASK = "language-audio";

/** Flash Lite checks a clip in 1.5 s p95; one MiMo check took 186 s in its eval (8 Nov 2026). */
const PRONUNCIATION_CHECK_TIMEOUT_MS = 15_000;
const PRONUNCIATION_LISTENS = 2;

/** `promptVersion` covers the voice and the instructions it was read with. */
export type SpeechProvenance = Pick<
  TaskProvenance,
  "generatedAt" | "model" | "promptVersion" | "runId"
>;

type VoicedAudio = {
  audio: Uint8Array;
  durationSeconds: number;
  format: "mp3";
  provenance: TaskProvenance;
};

export type AudioResult = {
  audio: Uint8Array;
  durationMs: number;
  format: "mp3";
  provenance: TaskProvenance;
};

export type LanguageAudioUsage = "alphabetSymbol";

const usagePrompts = { alphabetSymbol: alphabetSymbolPrompt } satisfies Record<
  LanguageAudioUsage,
  string
>;

type LookAlike = { [Key in keyof WordIpa]: NonNullable<WordIpa[Key]> };

/**
 * Each automatic model is tried once: the next one is the retry. An explicit model gets a second
 * attempt, since transport retries can't see silent or malformed audio. A word English spells the
 * same only goes to Gemini Flash: in the 8 Nov 2026 eval Flash Lite misread two such words and
 * MAI-Voice read three the English way.
 */
function getSpeechModels({
  lookAlike,
  language,
  model,
}: {
  lookAlike: LookAlike | null;
  language: string;
  model?: SpeechModelName;
}): readonly SpeechModelName[] {
  if (model) {
    return [model, model];
  }

  if (lookAlike) {
    return [speechModels.geminiFlash, speechModels.geminiFlash, speechModels.geminiFlash];
  }

  return getSpeakingModels({
    candidates: [
      speechModels.geminiFlash,
      speechModels.geminiFlashLite,
      speechModels.maiVoiceFlash,
    ],
    language,
  });
}

/**
 * Only a word alone gets read the English way: in a sentence the other words give the language
 * away. Null when the IPA couldn't be written, so the clip is still voiced.
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
    logError("Writing a word's IPA failed; voicing it without:", error.name);
    return null;
  }

  const { englishIpa, ipa } = data.data;
  return englishIpa && ipa ? { englishIpa, ipa } : null;
}

/**
 * Two listens, since one let a half-English "time" through that another caught (11 Oct 2026). With
 * no answer at all the clip is kept: the IPA already steers it, and no audio is worse.
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
      logError("Checking a word's pronunciation failed:", error.name);
    }
  }

  if (checks.some((check) => !check.soundsNative)) {
    throw new Error(`${model} didn't read the word with its language's sounds`);
  }
}

/** Carries the clip, so it can still be kept when every model adds to theirs. */
class AddedToClipError extends Error {
  readonly added: ClipAddition;
  readonly voiced: VoicedAudio;

  constructor({ added, voiced }: { added: ClipAddition; voiced: VoicedAudio }) {
    super(`${voiced.provenance.model} added ${added} to the clip`);
    this.name = "AddedToClipError";
    this.added = added;
    this.voiced = voiced;
  }
}

type VoiceInput = {
  analytics?: AiGenerationContext;
  language: string;
  lookAlike: LookAlike | null;
  requestedModel: SpeechModelName;
  text: string;
  usage?: LanguageAudioUsage;
  voice: TTSVoice;
};

/**
 * Inside the retry boundary, so malformed, silent or overlong audio, a word read the English way or
 * a clip that says more than its text falls back like a transport failure.
 */
async function generateWithModel({
  analytics,
  language,
  lookAlike,
  model,
  requestedModel,
  text,
  usage,
  voice,
}: VoiceInput & { model: SpeechModelName }): Promise<VoicedAudio> {
  const maxSeconds = getMaxSeconds(text);

  const { instructions, promptVersion } = getLanguageAudioPrompt({
    ...(lookAlike ? { ipa: lookAlike.ipa } : {}),
    language,
    model,
    usagePrompt: usage ? usagePrompts[usage] : "",
    voice,
  });

  const { audio: wavAudio, provenance } = await generateRecordedSpeech({
    analytics,
    instructions,
    language,
    model,
    promptVersion,
    requestedModel,
    task: TASK,
    text,
    voice,
  });

  assertExpectedAudioSize({ audio: wavAudio, maxSeconds, model });

  const { audio, durationSeconds } = await convertWavToMp3({ audio: wavAudio, maxSeconds, model });

  const [added] = await Promise.all([
    findClipAddition({ analytics, audio, language, text }),
    lookAlike
      ? assertNativeReading({ analytics, audio, language, lookAlike, model, text })
      : undefined,
  ]);

  const voiced: VoicedAudio = { audio, durationSeconds, format: "mp3", provenance };

  if (added) {
    throw new AddedToClipError({ added, voiced });
  }

  return voiced;
}

/**
 * Each adapter owns transient request retries; this layer owns cross-model and quality retries.
 * When every model adds to its clip, the first such clip is kept, so a checker's false alarm never
 * leaves a word silent.
 */
async function generateWithFallback({
  firstAdded,
  models,
  ...input
}: VoiceInput & {
  firstAdded?: AddedToClipError;
  models: readonly SpeechModelName[];
}): Promise<VoicedAudio> {
  const [model, ...remainingModels] = models;

  if (!model) {
    throw new Error("No speech model configured");
  }

  try {
    return await generateWithModel({ ...input, model });
  } catch (error) {
    if (isBlockedTestCall(error)) {
      throw error;
    }

    const added = firstAdded ?? (error instanceof AddedToClipError ? error : undefined);

    if (remainingModels.length > 0) {
      return generateWithFallback({ ...input, firstAdded: added, models: remainingModels });
    }

    if (added) {
      logError(`Every speech model added to its clip; keeping the first: ${added.message}`);
      return added.voiced;
    }

    const lastError = error instanceof Error ? error : new Error(String(error));
    logError("All TTS providers failed after retries:", lastError.message);
    throw lastError;
  }
}

/**
 * The result names the model that actually voiced it, after any fallback; every voicing it paid
 * for, kept or not, is recorded once.
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
  const models = getSpeechModels({ language, lookAlike, ...(model ? { model } : {}) });
  const [requestedModel = speechModels.geminiFlash] = models;

  return safeAsync(async () => {
    const voiced = await generateWithFallback({
      analytics,
      language,
      lookAlike,
      models,
      requestedModel,
      text,
      ...(usage ? { usage } : {}),
      voice,
    });

    return {
      audio: voiced.audio,
      durationMs: Math.round(voiced.durationSeconds * MS_PER_SECOND),
      format: voiced.format,
      provenance: voiced.provenance,
    };
  });
}
