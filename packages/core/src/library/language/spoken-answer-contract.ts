import { normalizeContentType } from "@zoonk/utils/upload";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { type RefusedUsage } from "../../entitlements/contract";
import { answerDurationSchema, answerTimeZoneSchema } from "../../learner/contract";
import { MAX_PRACTICE_ANSWERS } from "../../mistakes/contract";
import { mistakePracticeFeedbackSchema } from "../../mistakes/practice-feedback";

/** What every app records: Opus in WebM, or AAC in MP4. */
const SPOKEN_AUDIO_MEDIA_TYPES = ["audio/webm", "audio/mp4", "audio/m4a", "audio/x-m4a"] as const;

const MAX_NOTEBOOK_ANSWER_IDS_LENGTH = 4096;

export const MAX_SPOKEN_AUDIO_BYTES = 2_000_000;

export const MAX_SPOKEN_ANSWER_DURATION_MS = 60_000;

export function isSpokenAudioMediaType(mediaType: string): boolean {
  const base = normalizeContentType(mediaType);
  return SPOKEN_AUDIO_MEDIA_TYPES.some((type) => type === base);
}

export const spokenAnswerFieldsSchema = z
  .object({
    answerIds: z
      .string()
      .max(MAX_NOTEBOOK_ANSWER_IDS_LENGTH)
      .transform((value, ctx) => {
        try {
          return JSON.parse(value) as unknown;
        } catch {
          ctx.issues.push({
            code: "custom",
            input: value,
            message: "Send answerIds as a JSON array",
          });

          return z.NEVER;
        }
      })
      .pipe(z.array(uuidSchema()).max(MAX_PRACTICE_ANSWERS - 1))
      .optional()
      .meta({ description: "For notebook practice, a JSON array of the run's earlier answer IDs" }),
    attemptId: uuidSchema().optional(),
    durationMs: z.coerce
      .number()
      .int()
      .min(0)
      .max(MAX_SPOKEN_ANSWER_DURATION_MS)
      .meta({ description: "How long the learner spoke, in milliseconds" }),
    goalId: uuidSchema().optional(),
    mistakeId: uuidSchema().optional(),
    practiceDurationMs: z.coerce.number().int().pipe(answerDurationSchema).optional(),
    studySessionId: uuidSchema().optional().meta({ description: "Today's study session, if any" }),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .refine((fields) => !fields.mistakeId || Boolean(fields.attemptId), {
    message: "Notebook recordings require an attemptId",
    path: ["attemptId"],
  });

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
      .meta({
        description:
          "The word said by a native voice; null when it has none, so apps read it aloud with a speech clip (`POST /speech-clips`)",
      }),
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
    attemptId: uuidSchema(),
    explanation: z
      .string()
      .nullable()
      .meta({ description: "What we heard and how to say the words that didn't match" }),
    isCorrect: z.boolean().meta({ description: "Every word was heard as expected" }),
    practice: mistakePracticeFeedbackSchema.optional(),
    score: z.number().min(0).max(1).meta({ description: "Share of words heard as expected" }),
    transcript: z.string(),
    words: z.array(spokenWordResultSchema),
    wordsToPractice: z
      .array(spokenPracticeWordSchema)
      .meta({
        description:
          "At most two words worth hearing again, as written in the sentence; each has its respelling and tip in `words`",
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
