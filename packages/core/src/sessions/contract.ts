import { z } from "zod";
import { answerTimeZoneSchema, itemAnswerInputSchema } from "../learner/contract";
import { type ListeningSetView } from "../library/listening/listening-set-view";

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

/** A typed word or short answer is a few words; anything longer isn't one. */
const MAX_TYPED_ANSWER_LENGTH = 500;

const typedAnswerSchema = z
  .object({
    text: z
      .string()
      .max(MAX_TYPED_ANSWER_LENGTH)
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

/** One answer to one of a block's questions. */
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

/** A learner's answer to a session question, in any of the formats sessions grade. */
export type QuestionAnswer = StudyAnswerInput["answer"];

type StudyAnswerFeedback = {
  /**
   * A statement left blank where a wrong answer cancels a right one: neither right nor a mistake,
   * so it shows no error and stays out of the notebook.
   */
  blank: boolean;
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
  /**
   * A recording's transcript, once this answer completes its questions in the block (before, it
   * would answer them); null otherwise.
   */
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
