import { z } from "zod";

const MAX_ANSWER_ITEMS = 50;
const MAX_ANSWER_TEXT_LENGTH = 500;
const MAX_MATCH_COLUMNS_MISTAKES = 50;

const answerTextSchema = z.string().max(MAX_ANSWER_TEXT_LENGTH);
const answerItemsSchema = z.array(answerTextSchema).max(MAX_ANSWER_ITEMS);
const matchPairSchema = z.object({ left: answerTextSchema, right: answerTextSchema });

/** What a learner answers on a language exercise, in the shape the checks grade. */
export const selectedAnswerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("fillBlank"), userAnswers: answerItemsSchema }),
  z.object({ arrangedWords: answerItemsSchema, kind: z.literal("listening") }),
  z.object({
    kind: z.literal("matchColumns"),
    mistakes: z.number().int().min(0).max(MAX_MATCH_COLUMNS_MISTAKES),
    userPairs: z.array(matchPairSchema).max(MAX_ANSWER_ITEMS),
  }),
  z.object({ kind: z.literal("multipleChoice"), selectedOptionId: answerTextSchema }),
  z.object({ arrangedWords: answerItemsSchema, kind: z.literal("reading") }),
  z.object({ kind: z.literal("translation"), selectedOptionId: answerTextSchema }),
]);

export type SelectedAnswer = z.infer<typeof selectedAnswerSchema>;
