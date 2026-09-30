import { normalizeContentType } from "@zoonk/utils/upload";
import { z } from "zod";
import { type RefusedUsage } from "../../entitlements/contract";
import { answerTimeZoneSchema } from "../../learner/contract";

/**
 * Recording formats browsers produce (WebM with Opus, or MP4 with AAC on
 * Safari) plus the file formats transcription models accept.
 */
const SPOKEN_AUDIO_MEDIA_TYPES = [
  "audio/webm",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
] as const;

/** Two megabytes holds well over a minute of compressed speech; a sentence takes seconds. */
export const MAX_SPOKEN_AUDIO_BYTES = 2_000_000;

/** A spoken answer is one sentence; a longer recording is a microphone left on. */
const MAX_SPOKEN_ANSWER_DURATION_MS = 60_000;

export function isSpokenAudioMediaType(mediaType: string): boolean {
  const base = normalizeContentType(mediaType);
  return SPOKEN_AUDIO_MEDIA_TYPES.some((type) => type === base);
}

/** The fields sent next to the recording. */
export const spokenAnswerFieldsSchema = z
  .object({
    durationMs: z.coerce
      .number()
      .int()
      .min(0)
      .max(MAX_SPOKEN_ANSWER_DURATION_MS)
      .meta({ description: "How long the learner spoke, in milliseconds" }),
    studySessionId: z.uuid().optional().meta({ description: "Today's study session, if any" }),
    timeZone: answerTimeZoneSchema,
  })
  .strict();

export type SpokenAnswerFields = z.infer<typeof spokenAnswerFieldsSchema>;

const spokenWordResultSchema = z
  .object({
    heard: z
      .string()
      .nullable()
      .meta({ description: "What we heard in this word's place; null when right or not heard" }),
    status: z.enum(["correct", "different", "missed"]),
    text: z.string().meta({ description: "The word as written in the expected sentence" }),
  })
  .meta({ id: "SpokenWordResult" });

const spokenPracticeWordSchema = spokenWordResultSchema
  .extend({
    audioUrl: z
      .string()
      .nullable()
      .meta({ description: "The word said by a native voice; null to use the device's voice" }),
    respelling: z
      .string()
      .nullable()
      .meta({ description: 'How it sounds, spelled for the learner\'s language ("rént")' }),
    tip: z
      .string()
      .nullable()
      .meta({ description: "One sound tip in the learner's language, when the word has a trap" }),
  })
  .meta({ id: "SpokenPracticeWord" });

export const spokenAnswerGradeSchema = z
  .object({
    attemptId: z.uuid(),
    explanation: z
      .string()
      .nullable()
      .meta({ description: "What we heard and how to say the words that didn't match" }),
    isCorrect: z.boolean().meta({ description: "Every word was heard as expected" }),
    score: z.number().min(0).max(1).meta({ description: "Share of words heard as expected" }),
    transcript: z.string(),
    words: z.array(spokenWordResultSchema),
    wordsToPractice: z
      .array(spokenPracticeWordSchema)
      .meta({
        description:
          "At most two words to highlight, as written in the sentence: tapping one plays it at normal and slow speed with its respelling and tip",
      }),
  })
  .meta({ id: "SpokenAnswerGrade" });

export type SpokenAnswerGrade = z.infer<typeof spokenAnswerGradeSchema>;

export type GradeSpokenAnswerResult =
  | { grade: SpokenAnswerGrade; status: "graded" }
  | { status: "invalidAudio" }
  | { status: "noSpeech" }
  | RefusedUsage
  | { status: "notFound" }
  | { status: "unauthorized" };
