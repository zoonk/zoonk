import { z } from "zod";
import { MAX_ESSAY_CHARACTERS } from "../essays/essay-contract";

/** A question asks for at most as many picks as it has options. */
const MAX_PICKS = 8;

/** A pick in a mock: an option, several options or true/false. Null leaves the question blank. */
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

/** A number typed into a numeric question's answer box, without its unit. */
const mockNumberSchema = z
  .object({ number: z.number().meta({ description: "A numeric question's answer" }) })
  .strict()
  .meta({ id: "MockNumber" });

/**
 * Text as the learner left it: an essay's so far, up to the longest essay the grader reads, or a
 * typed question's word or short phrase.
 */
export const mockTextSchema = z
  .object({ text: z.string().max(MAX_ESSAY_CHARACTERS) })
  .strict()
  .meta({ id: "MockText" });

/** What an answer sheet holds for a question: a pick, a number, or text. */
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

/** A play of one of the running listening section's recordings, counted as it starts. */
export const mockPlayInputSchema = z
  .object({ setId: z.uuid().meta({ description: "The recording's set: a question's `set.id`" }) })
  .strict()
  .meta({ id: "MockPlayInput" });
