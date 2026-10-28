import { z } from "zod";
import { MAX_ESSAY_CHARACTERS } from "../essays/essay-contract";

const MAX_PICKS = 8;

export const mockChoiceSchema = z
  .union([
    z.object({ selectedIndex: z.int().min(0) }).strict(),
    z
      .object({
        selectedIndexes: z
          .array(z.int().min(0))
          .min(1)
          .max(MAX_PICKS)
          .meta({ description: "The options picked, in any order, as indexes into `options`" }),
      })
      .strict(),
    z.object({ isTrue: z.boolean() }).strict(),
  ])
  .meta({ id: "MockChoice" });

export type MockChoice = z.infer<typeof mockChoiceSchema>;

const mockNumberSchema = z
  .object({ number: z.number().meta({ description: "A numeric question's answer" }) })
  .strict()
  .meta({ id: "MockNumber" });

export const mockTextSchema = z
  .object({ text: z.string().max(MAX_ESSAY_CHARACTERS) })
  .strict()
  .meta({ id: "MockText" });

export const mockAnswerSchema = z
  .union([mockChoiceSchema, mockNumberSchema, mockTextSchema])
  .meta({ id: "MockAnswer" });

export type MockAnswer = z.infer<typeof mockAnswerSchema>;

/** An hour covers the slowest question; anything longer is a tab left open. */
const MAX_ANSWER_DURATION_MS = 3_600_000;

export const mockAnswerInputSchema = z
  .object({
    answer: mockAnswerSchema
      .nullable()
      .meta({
        description:
          "The answer by the question's `format`: a pick (`selectedIndexes` where it asks for several), a number for `numeric`, the text for `typed` and `essay`; null leaves it blank",
      }),
    durationMs: z
      .int()
      .min(0)
      .max(MAX_ANSWER_DURATION_MS)
      .meta({ description: "Total time spent on the question so far" }),
    flagged: z.boolean().meta({ description: "Marked to come back to; also means unsure" }),
    itemId: z.uuid(),
  })
  .strict()
  .meta({ id: "MockAnswerInput" });

export type MockAnswerInput = z.infer<typeof mockAnswerInputSchema>;

export const mockPlayInputSchema = z
  .object({ setId: z.uuid().meta({ description: "The recording's set: a question's `set.id`" }) })
  .strict()
  .meta({ id: "MockPlayInput" });
