import { z } from "zod";
import { answerTimeZoneSchema } from "../../learner/contract";

/** A spoken word is a second or two; a longer recording is a microphone left on. */
const MAX_WORD_RECORDING_MS = 30_000;

const pronunciationWordSchema = z
  .object({
    audioUrl: z.string().nullable().meta({ description: "A native speaker's recording" }),
    id: z.uuid().meta({ description: "The review's id" }),
    respelling: z
      .string()
      .nullable()
      .meta({ description: "How to say it, spelled for the learner's language" }),
    romanization: z.string().nullable(),
    tip: z
      .string()
      .nullable()
      .meta({ description: "The sound speakers of the learner's language tend to get wrong" }),
    word: z.string(),
  })
  .meta({ id: "PronunciationReviewWord" });

export const pronunciationReviewsViewSchema = z
  .object({
    goalId: z.uuid(),
    language: z.string().meta({ description: "The language the words are in" }),
    words: z
      .array(pronunciationWordSchema)
      .meta({ description: "Words due today, at most a round's worth" }),
  })
  .meta({ id: "PronunciationReviews" });

export type PronunciationReviewsView = z.infer<typeof pronunciationReviewsViewSchema>;

/** The fields sent next to a recording of one review word. */
export const pronunciationAnswerFieldsSchema = z
  .object({
    durationMs: z.coerce
      .number()
      .int()
      .min(0)
      .max(MAX_WORD_RECORDING_MS)
      .meta({ description: "How long the learner spoke, in milliseconds" }),
    roundId: z.uuid().meta({ description: "Groups the answers of one round, for its completion" }),
    timeZone: answerTimeZoneSchema,
  })
  .strict();

export type PronunciationAnswerFields = z.infer<typeof pronunciationAnswerFieldsSchema>;

export const pronunciationAnswerGradeSchema = z
  .object({
    attemptId: z.uuid(),
    isCorrect: z.boolean().meta({ description: "The word was heard as expected" }),
    nextReviewAt: z.iso
      .datetime()
      .nullable()
      .meta({ description: "When the word comes back; null once it's learned" }),
    transcript: z.string().meta({ description: "What we heard" }),
  })
  .meta({ id: "PronunciationAnswerGrade" });

export type PronunciationAnswerGrade = z.infer<typeof pronunciationAnswerGradeSchema>;

export const pronunciationRoundInputSchema = z
  .object({ goalId: z.uuid(), timeZone: answerTimeZoneSchema })
  .strict()
  .meta({ id: "PronunciationRoundInput" });

export type PronunciationRoundInput = z.infer<typeof pronunciationRoundInputSchema>;

export const pronunciationRoundResultSchema = z
  .object({ brainPower: z.int().min(0), correct: z.int().min(0), total: z.int().min(0) })
  .meta({ id: "PronunciationRoundResult" });

export type PronunciationRoundResult = z.infer<typeof pronunciationRoundResultSchema>;
