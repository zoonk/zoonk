import { z } from "zod";
import { answerTimeZoneSchema, itemAnswerInputSchema } from "../learner/contract";
import { type ListeningSetView } from "../library/listening/listening-set-view";
import { MAX_SESSION_TYPED_ANSWER_LENGTH } from "./answer-limits";
import { areaIdSchema } from "./day-block";

export const todayStudySessionInputSchema = z
  .object({
    goalId: z
      .uuid()
      .optional()
      .meta({ description: "The goal whose day to read; defaults to the active goal" }),
    timeZone: answerTimeZoneSchema.meta({
      description:
        "The device's IANA timezone. The goal follows it first: a goal without a timezone stores it, and a learner who moved takes it while nothing was done yet in the goal's day. The day is then read in the goal's timezone",
    }),
  })
  .strict()
  .meta({ id: "TodayStudySessionQuery" });

export type TodayStudySessionInput = z.infer<typeof todayStudySessionInputSchema>;

export const studySessionTimeZoneInputSchema = z
  .object({ timeZone: answerTimeZoneSchema })
  .strict()
  .meta({ id: "StudySessionTimeZone" });

export type StudySessionTimeZoneInput = z.infer<typeof studySessionTimeZoneInputSchema>;

export const studyBlockStartInputSchema = z
  .object({
    afterWriting: z
      .boolean()
      .optional()
      .meta({
        description:
          "Set once the learner waited for the run writing a challenge's questions (`QUESTIONS_NEEDED`) to end, whether every call succeeded or not: the challenge then starts with the questions the bank holds, at least five. Without it, a challenge planned before its questions were written waits for all ten.",
      }),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "StudyBlockStart" });

export type StudyBlockStartInput = z.infer<typeof studyBlockStartInputSchema>;

export const areaPracticeInputSchema = z
  .object({
    areaId: areaIdSchema.meta({
      description: "The area to practice, as the goal's preparation lists it",
    }),
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

const typedAnswerSchema = z
  .object({
    text: z
      .string()
      .max(MAX_SESSION_TYPED_ANSWER_LENGTH)
      .meta({ description: "A typed question's answer: a word, a number or a short phrase" }),
  })
  .strict()
  .meta({ id: "TypedAnswer" });

const orderAnswerSchema = z
  .object({
    order: z
      .array(z.number().int().min(0))
      .meta({
        description:
          "An ordering question's answer: the indexes of its shown steps (`options`), in the order the learner put them",
      }),
  })
  .strict()
  .meta({ id: "OrderAnswer" });

export const studyAnswerInputSchema = z
  .object({
    answer: z.union([
      itemAnswerInputSchema.shape.answer,
      matchAnswerSchema,
      numberAnswerSchema,
      typedAnswerSchema,
      orderAnswerSchema,
    ]),
    durationMs: itemAnswerInputSchema.shape.durationMs,
    itemId: z.uuid(),
    timeZone: answerTimeZoneSchema,
  })
  .strict()
  .meta({ id: "StudyAnswerInput" });

export type StudyAnswerInput = z.infer<typeof studyAnswerInputSchema>;

export type QuestionAnswer = StudyAnswerInput["answer"];

type StudyAnswerFeedback = {
  /** Blank net-scored statements count as neither correct nor mistakes and never enter the notebook. */
  blank: boolean;
  /** Checkpoints withhold answers and explanations until the duel ends. */
  correctAnswer: QuestionAnswer | null;
  explanation: string | null;
  hyperdrive: { level: number; streak: number };
  isCorrect: boolean;
  /** A saved mistake this answer fixed (answered right on a later day). */
  mistakeFixed: boolean;
  pauseSuggested: boolean;
  /** Available reinforcement lessons for this checkpoint's misses; null for other blocks. */
  reinforcementLessons: number | null;
  savedToNotebook: boolean;
  /** Hidden until the recording's questions are complete, to avoid revealing their answers. */
  transcript: ListeningSetView["transcript"];
  /** In a trap drill, the trap the question set: the misconception a wrong answer carries. */
  trap: string | null;
  /** A math question's worked steps with the numbers it showed; empty for other questions. */
  workedSteps: string[];
};

export type StudyAnswerResult =
  | { feedback: StudyAnswerFeedback; status: "ready" }
  | { status: "alreadyAnswered" }
  | { status: "blockNotActive" }
  | { status: "invalidItem" }
  | { status: "notFound" }
  | { status: "unauthorized" };
