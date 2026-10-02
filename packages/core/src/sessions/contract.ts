import { z } from "zod";
import { answerTimeZoneSchema, itemAnswerInputSchema } from "../learner/contract";

export const todayStudySessionInputSchema = z
  .object({
    goalId: z
      .uuid()
      .optional()
      .meta({ description: "The goal whose session to open; defaults to the active goal" }),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "TodayStudySessionQuery" });

export type TodayStudySessionInput = z.infer<typeof todayStudySessionInputSchema>;

export const studySessionTimeZoneInputSchema = z
  .object({ timeZone: answerTimeZoneSchema })
  .strict()
  .meta({ id: "StudySessionTimeZone" });

export type StudySessionTimeZoneInput = z.infer<typeof studySessionTimeZoneInputSchema>;

const MAX_AREA_ID_LENGTH = 100;

export const areaPracticeInputSchema = z
  .object({
    areaId: z
      .string()
      .min(1)
      .max(MAX_AREA_ID_LENGTH)
      .meta({ description: "The area to practice, as the goal's preparation lists it" }),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "AreaPracticeInput" });

export type AreaPracticeInput = z.infer<typeof areaPracticeInputSchema>;

const matchAnswerSchema = z
  .object({
    matches: z
      .array(z.number().int().min(0))
      .meta({ description: "For each left entry, the index of the right entry it was matched to" }),
  })
  .strict()
  .meta({ id: "MatchAnswer" });

const numberAnswerSchema = z
  .object({
    number: z
      .number()
      .meta({ description: "A math question's answer, as a plain number without its unit" }),
  })
  .strict()
  .meta({ id: "NumberAnswer" });

/** One answer to one of a block's questions. */
export const studyAnswerInputSchema = z
  .object({
    answer: z.union([itemAnswerInputSchema.shape.answer, matchAnswerSchema, numberAnswerSchema]),
    durationMs: itemAnswerInputSchema.shape.durationMs,
    itemId: z.uuid(),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "StudyAnswerInput" });

export type StudyAnswerInput = z.infer<typeof studyAnswerInputSchema>;

/** A learner's answer to a session question, in any of the formats sessions grade. */
export type QuestionAnswer = StudyAnswerInput["answer"];

type StudyAnswerFeedback = {
  /** Checkpoints are duels without hints: the right answer and why wait until the duel ends. */
  correctAnswer: QuestionAnswer | null;
  explanation: string | null;
  hyperdrive: { level: number; streak: number };
  isCorrect: boolean;
  /** A saved mistake this answer fixed (answered right on a later day). */
  mistakeFixed: boolean;
  pauseSuggested: boolean;
  /** A wrong answer goes to the mistakes notebook on its own. */
  savedToNotebook: boolean;
  /** In a trap drill, the trap the question set: the misconception a wrong answer carries. */
  trap: string | null;
  /** A math question's worked steps with the numbers it showed; empty for other questions. */
  workedSteps: string[];
};

export type StudyAnswerResult =
  | { feedback: StudyAnswerFeedback; status: "ready" }
  | { retryAfterSeconds: number; status: "slowDown" }
  | { status: "alreadyAnswered" }
  | { status: "blockNotActive" }
  | { status: "invalidItem" }
  | { status: "notFound" }
  | { status: "unauthorized" };
