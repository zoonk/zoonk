import { z } from "zod";

type SelectedAnswerSchemaLimits = {
  maxItems?: number;
  maxMistakes?: number;
  maxTextLength?: number;
};

function getAnswerTextSchema(maxTextLength: number | undefined) {
  if (maxTextLength === undefined) {
    return z.string();
  }

  return z.string().max(maxTextLength);
}

function getAnswerItemsSchema<T extends z.ZodType>({
  itemSchema,
  maxItems,
}: {
  itemSchema: T;
  maxItems: number | undefined;
}) {
  const itemsSchema = z.array(itemSchema);

  if (maxItems === undefined) {
    return itemsSchema;
  }

  return itemsSchema.max(maxItems);
}

function getMistakesSchema(maxMistakes: number | undefined) {
  if (maxMistakes === undefined) {
    return z.number();
  }

  return z.number().int().min(0).max(maxMistakes);
}

/** Keeps completion answers and stricter derived boundaries on one discriminated data contract. */
export function createSelectedAnswerSchema({
  maxItems,
  maxMistakes,
  maxTextLength,
}: SelectedAnswerSchemaLimits = {}) {
  const answerTextSchema = getAnswerTextSchema(maxTextLength);
  const answerItemsSchema = getAnswerItemsSchema({ itemSchema: answerTextSchema, maxItems });
  const matchPairSchema = z.object({ left: answerTextSchema, right: answerTextSchema });

  return z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("fillBlank"), userAnswers: answerItemsSchema }),
    z.object({ arrangedWords: answerItemsSchema, kind: z.literal("listening") }),
    z.object({
      incorrectPair: matchPairSchema.optional(),
      kind: z.literal("matchColumns"),
      mistakes: getMistakesSchema(maxMistakes),
      userPairs: getAnswerItemsSchema({ itemSchema: matchPairSchema, maxItems }),
    }),
    z.object({ kind: z.literal("multipleChoice"), selectedOptionId: answerTextSchema }),
    z.object({ arrangedWords: answerItemsSchema, kind: z.literal("reading") }),
    z.object({ kind: z.literal("selectImage"), selectedOptionId: answerTextSchema }),
    z.object({ kind: z.literal("sortOrder"), userOrder: answerItemsSchema }),
    z.object({ kind: z.literal("translation"), selectedOptionId: answerTextSchema }),
  ]);
}
